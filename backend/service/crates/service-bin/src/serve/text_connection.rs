use super::actor::RuntimeActor;
use super::presence;
use super::relay_session::RelaySessionManager;
use super::wire::{ClientCommandFrame, server_event_frame_text, server_response_frame_text};
use crate::serve::ServeState;
use service_runtime::consumer_protocol::{ConduitProtocolError, ConduitRuntimeEvent};
use service_runtime::{ConsumerResponse, RuntimeEvent, RuntimeEventKind};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{Mutex, mpsc};

#[derive(Clone)]
pub(super) struct TextConnectionRuntime {
    pub(super) actor: RuntimeActor,
    pub(super) close_presence_on_connection_close: bool,
    pub(super) presence: Option<Arc<presence::PresenceStore>>,
    pub(super) relay_session: Option<RelayTextSession>,
    pub(super) presence_session_id: Option<String>,
    pub(super) watches: Option<SharedWatchState>,
    pub(super) connection_kind: &'static str,
}

impl TextConnectionRuntime {
    pub(super) fn direct(state: &ServeState) -> Self {
        Self {
            actor: state.actor.clone(),
            close_presence_on_connection_close: true,
            presence: Some(Arc::clone(&state.presence)),
            relay_session: None,
            presence_session_id: None,
            watches: None,
            connection_kind: "direct",
        }
    }

    pub(super) fn relay(
        actor: RuntimeActor,
        presence: Arc<presence::PresenceStore>,
        presence_session_id: String,
        generation: u64,
        sessions: Arc<RelaySessionManager>,
        watches: SharedWatchState,
    ) -> Self {
        Self {
            actor,
            close_presence_on_connection_close: false,
            presence: Some(presence),
            relay_session: Some(RelayTextSession {
                connection_id: presence_session_id.clone(),
                generation,
                sessions,
            }),
            presence_session_id: Some(presence_session_id),
            watches: Some(watches),
            connection_kind: "relay",
        }
    }
}

pub(super) type SharedWatchState = Arc<Mutex<WatchState>>;
type OutboundSender = mpsc::UnboundedSender<OutboundFrame>;

#[derive(Clone)]
pub(super) struct RelayTextSession {
    connection_id: String,
    generation: u64,
    sessions: Arc<RelaySessionManager>,
}

#[derive(Debug)]
pub(super) enum OutboundFrame {
    Event(ConduitRuntimeEvent),
    Response {
        id: String,
        response: Box<ConsumerResponse>,
    },
}

#[expect(
    clippy::cognitive_complexity,
    clippy::too_many_lines,
    reason = "Connection loop coordinates inbound command frames, outbound runtime frames, and lifecycle telemetry."
)]
pub(super) async fn run_text_connection(
    mut runtime: TextConnectionRuntime,
    mut inbound_receiver: mpsc::UnboundedReceiver<String>,
    outbound_text: mpsc::UnboundedSender<String>,
    connection_id: u64,
) {
    if runtime.close_presence_on_connection_close && runtime.presence_session_id.is_none() {
        runtime.presence_session_id = Some(format!("direct:{connection_id}"));
    }
    tracing::info!(
        event_name = "session_socket.connection.open",
        source = "service-bin",
        connection_id,
        connection_kind = runtime.connection_kind
    );
    let (outbound, mut outbound_receiver) = mpsc::unbounded_channel();
    let watches = runtime
        .watches
        .clone()
        .unwrap_or_else(|| Arc::new(Mutex::new(WatchState::default())));
    let event_forwarder = tokio::spawn(forward_live_events(
        runtime.actor.subscribe(),
        Arc::clone(&watches),
        outbound.clone(),
        connection_id,
    ));
    loop {
        tokio::select! {
            text = inbound_receiver.recv() => {
                let Some(text) = text else {
                    break;
                };
                handle_client_text(
                    runtime.clone(),
                    &text,
                    Arc::clone(&watches),
                    outbound.clone(),
                    connection_id,
                );
            }
            outbound = outbound_receiver.recv() => {
                let Some(outbound) = outbound else {
                    break;
                };
                let Ok(text) = outbound_text_frame(outbound) else {
                    tracing::warn!(
                        event_name = "session_socket.connection.serialize_failed",
                        source = "service-bin",
                        connection_id,
                        connection_kind = runtime.connection_kind
                    );
                    break;
                };
                if outbound_text.send(text).is_err() {
                    tracing::warn!(
                        event_name = "session_socket.connection.send_failed",
                        source = "service-bin",
                        connection_id,
                        connection_kind = runtime.connection_kind
                    );
                    break;
                }
            }
        }
    }
    event_forwarder.abort();
    if let (true, Some(presence), Some(session_id)) = (
        runtime.close_presence_on_connection_close,
        runtime.presence.as_ref(),
        runtime.presence_session_id.as_deref(),
    ) {
        presence.mark_session_closed(session_id);
    }
    tracing::info!(
        event_name = "session_socket.connection.close",
        source = "service-bin",
        connection_id,
        connection_kind = runtime.connection_kind
    );
}

pub(super) fn handle_client_text(
    runtime: TextConnectionRuntime,
    text: &str,
    watches: SharedWatchState,
    outbound: OutboundSender,
    connection_id: u64,
) {
    let frame = ClientCommandFrame::from_text(text);
    tokio::spawn(dispatch_client_frame(
        runtime,
        frame,
        watches,
        outbound,
        connection_id,
    ));
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Frame dispatch covers validation, actor dispatch, watch updates, and response telemetry."
)]
async fn dispatch_client_frame(
    runtime: TextConnectionRuntime,
    frame: ClientCommandFrame,
    watches: SharedWatchState,
    outbound: OutboundSender,
    connection_id: u64,
) {
    let command_name = frame.command_name().to_owned();
    let id = frame.id();
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "session_socket.command.start",
        source = "service-bin",
        connection_id,
        command_id = %id,
        command = %command_name
    );
    let response = match frame.rejection() {
        Some(rejection) => rejection,
        None => {
            let command = frame.command();
            match runtime.presence.as_ref().map(|store| {
                store.handle_command(
                    &command,
                    presence::presence_transport(runtime.connection_kind),
                    runtime.presence_session_id.as_deref(),
                )
            }) {
                Some(presence::PresenceCommandOutcome::Handled(response)) => *response,
                Some(presence::PresenceCommandOutcome::NotPresence) | None => {
                    runtime.actor.dispatch(command).await
                }
            }
        }
    };
    if response.ok {
        watches
            .lock()
            .await
            .apply_command(&command_name, &response.result);
        if let Some(relay_session) = runtime.relay_session.as_ref() {
            relay_session
                .sessions
                .mark_verified(&relay_session.connection_id, relay_session.generation)
                .await;
        }
    }
    log_command_finish(
        connection_id,
        &id,
        &command_name,
        &response,
        started_at.elapsed().as_millis(),
    );
    let _send_status = outbound.send(OutboundFrame::Response {
        id,
        response: Box::new(response),
    });
}

fn log_command_finish(
    connection_id: u64,
    command_id: &str,
    command_name: &str,
    response: &ConsumerResponse,
    duration_ms: u128,
) {
    if response.ok {
        log_command_finish_ok(connection_id, command_id, command_name, duration_ms);
    } else {
        log_command_finish_error(
            connection_id,
            command_id,
            command_name,
            response,
            duration_ms,
        );
    }
}

fn log_command_finish_ok(
    connection_id: u64,
    command_id: &str,
    command_name: &str,
    duration_ms: u128,
) {
    tracing::info!(
        event_name = "session_socket.command.finish",
        source = "service-bin",
        connection_id,
        command_id = %command_id,
        command = %command_name,
        ok = true,
        duration_ms
    );
}

fn log_command_finish_error(
    connection_id: u64,
    command_id: &str,
    command_name: &str,
    response: &ConsumerResponse,
    duration_ms: u128,
) {
    let error_code = response
        .error
        .as_ref()
        .map(|error| error.code.as_str())
        .unwrap_or("unknown");
    let error_message = response
        .error
        .as_ref()
        .map(|error| error.message.as_str())
        .unwrap_or("missing response error");
    tracing::warn!(
        event_name = "session_socket.command.finish",
        source = "service-bin",
        connection_id,
        command_id = %command_id,
        command = %command_name,
        ok = false,
        duration_ms,
        error_code = %error_code,
        error_message = %error_message
    );
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Live-event forwarding intentionally gates on watches and handles backpressure/closure conditions."
)]
async fn forward_live_events(
    mut live_events: tokio::sync::broadcast::Receiver<RuntimeEvent>,
    watches: SharedWatchState,
    outbound: OutboundSender,
    connection_id: u64,
) {
    loop {
        let Ok(event) = live_events.recv().await else {
            tracing::debug!(
                event_name = "session_socket.events.closed",
                source = "service-bin",
                connection_id
            );
            return;
        };
        let product_event = {
            let watches = watches.lock().await;
            if !watches.has_watches() {
                Ok(None)
            } else {
                watches.product_event(&event)
            }
        };
        match product_event {
            Ok(Some(event)) => {
                if outbound.send(OutboundFrame::Event(event)).is_err() {
                    tracing::warn!(
                        event_name = "session_socket.events.send_failed",
                        source = "service-bin",
                        connection_id
                    );
                    return;
                }
            }
            Ok(None) => {}
            Err(error) => {
                tracing::warn!(
                    event_name = "session_socket.events.contract_violation",
                    source = "service-bin",
                    connection_id,
                    event_kind = ?event.kind,
                    error = %error
                );
                return;
            }
        }
    }
}

fn outbound_text_frame(outbound: OutboundFrame) -> std::result::Result<String, ()> {
    match outbound {
        OutboundFrame::Event(event) => server_event_frame_text(event).map_err(|_error| ()),
        OutboundFrame::Response { id, response } => {
            server_response_frame_text(id, *response).map_err(|_error| ())
        }
    }
}

#[derive(Debug, Default)]
pub(super) struct WatchState {
    sessions: bool,
    timelines: HashSet<String>,
}

impl WatchState {
    pub(super) fn has_watches(&self) -> bool {
        self.sessions || !self.timelines.is_empty()
    }

    pub(super) fn apply_command(&mut self, command: &str, result: &serde_json::Value) {
        match command {
            "sessions/watch" => {
                self.sessions = true;
            }
            "session/watch" => {
                if let Some(open_session_id) = result
                    .get("openSessionId")
                    .and_then(serde_json::Value::as_str)
                {
                    self.timelines.insert(open_session_id.to_owned());
                }
            }
            _ => {}
        }
    }

    pub(super) fn product_event(
        &self,
        event: &RuntimeEvent,
    ) -> std::result::Result<Option<ConduitRuntimeEvent>, ConduitProtocolError> {
        match event.kind {
            RuntimeEventKind::SessionsIndexChanged if self.sessions => {
                ConduitRuntimeEvent::from_runtime_event(event).map(Some)
            }
            RuntimeEventKind::SessionTimelineChanged => {
                let open_session_id = event
                    .payload
                    .get("openSessionId")
                    .and_then(serde_json::Value::as_str)
                    .ok_or(ConduitProtocolError::InvalidField {
                        field: "openSessionId",
                    })?;
                if !self.timelines.contains(open_session_id) {
                    return Ok(None);
                }
                ConduitRuntimeEvent::from_runtime_event(event).map(Some)
            }
            _ => Ok(None),
        }
    }
}
