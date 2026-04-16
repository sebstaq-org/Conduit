//! WebSocket product service for the consumer runtime API.

mod actor;
mod client_logs;
mod wire;

use crate::error::Result;
use crate::local_store::open_product_store;
use actor::RuntimeActor;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use session_store::LocalStore;
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, mpsc};
use tower_http::cors::CorsLayer;
use wire::{ClientCommandFrame, ServerEventFrame, ServerResponseFrame};

static NEXT_CONNECTION_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct ServeState {
    actor: RuntimeActor,
    client_log_sink: client_logs::ClientLogSink,
}

const CATALOG_COMMANDS: [&str; 20] = [
    "initialize",
    "session/new",
    "session/set_config_option",
    "session/prompt",
    "session/respond_interaction",
    "session/cancel",
    "provider/disconnect",
    "projects/add",
    "projects/list",
    "projects/remove",
    "projects/suggestions",
    "projects/update",
    "settings/get",
    "settings/update",
    "sessions/grouped",
    "sessions/watch",
    "providers/config_snapshot",
    "session/open",
    "session/history",
    "session/watch",
];

/// Runs the versioned consumer WebSocket service.
///
/// # Errors
///
/// Returns an error when the TCP listener cannot bind or the server exits with
/// an I/O failure.
pub(crate) async fn run(host: &str, port: u16) -> Result<()> {
    let listener = TcpListener::bind((host, port)).await?;
    axum::serve(
        listener,
        router(open_product_store()?).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

fn router(local_store: LocalStore) -> Router {
    router_with_actor(RuntimeActor::start(local_store))
}

fn router_with_actor(actor: RuntimeActor) -> Router {
    let client_log_sink = client_logs::ClientLogSink::detect();
    Router::new()
        .route("/health", get(health))
        .route("/api/catalog", get(catalog))
        .route("/api/session", get(session_socket))
        .route("/api/client-log", post(client_log_ingest))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(ServeState {
            actor,
            client_log_sink,
        }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "ok": true,
        "service": "conduit-service",
        "transport": "websocket",
    }))
}

async fn catalog() -> Json<serde_json::Value> {
    Json(json!({
        "providers": ["claude", "copilot", "codex"],
        "commands": CATALOG_COMMANDS,
    }))
}

async fn session_socket(
    State(state): State<Arc<ServeState>>,
    websocket: WebSocketUpgrade,
) -> impl IntoResponse {
    websocket.on_upgrade(move |socket| handle_socket(socket, state))
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Client-log ingest validates client scope and maps sink outcomes to HTTP status with telemetry."
)]
async fn client_log_ingest(
    State(state): State<Arc<ServeState>>,
    ConnectInfo(client_addr): ConnectInfo<SocketAddr>,
    Json(batch): Json<client_logs::ClientLogBatch>,
) -> StatusCode {
    if !is_loopback_client(client_addr) {
        tracing::warn!(
            event_name = "client_log.ingest.rejected",
            source = "service-bin",
            reason = "non_loopback_client",
            client_addr = %client_addr
        );
        return StatusCode::FORBIDDEN;
    }

    let record_count = batch.record_count();
    match state.client_log_sink.append(batch).await {
        Ok(()) => {
            tracing::debug!(
                event_name = "client_log.ingest.ok",
                source = "service-bin",
                record_count
            );
            StatusCode::NO_CONTENT
        }
        Err(error) => {
            let status = if error.is_payload_error() {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            tracing::warn!(
                event_name = "client_log.ingest.failed",
                source = "service-bin",
                status = status.as_u16(),
                record_count,
                error = ?error
            );
            status
        }
    }
}

fn is_loopback_client(client_addr: SocketAddr) -> bool {
    client_addr.ip().is_loopback()
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Socket loop coordinates client frames, outbound queue, and lifecycle telemetry."
)]
async fn handle_socket(socket: WebSocket, state: Arc<ServeState>) {
    let connection_id = NEXT_CONNECTION_ID.fetch_add(1, Ordering::Relaxed);
    tracing::info!(
        event_name = "session_socket.connection.open",
        source = "service-bin",
        connection_id
    );
    let (mut sender, mut receiver) = socket.split();
    let (outbound, mut outbound_receiver) = mpsc::unbounded_channel();
    let watches = Arc::new(Mutex::new(WatchState::default()));
    let event_forwarder = tokio::spawn(forward_live_events(
        state.actor.subscribe(),
        Arc::clone(&watches),
        outbound.clone(),
        connection_id,
    ));
    loop {
        tokio::select! {
            message = receiver.next() => {
                let Some(Ok(message)) = message else {
                    break;
                };
                if !handle_client_message(
                    &state.actor,
                    message,
                    Arc::clone(&watches),
                    outbound.clone(),
                    connection_id
                ) {
                    break;
                }
            }
            outbound = outbound_receiver.recv() => {
                let Some(outbound) = outbound else {
                    break;
                };
                if send_outbound(&mut sender, outbound).await.is_err() {
                    tracing::warn!(
                        event_name = "session_socket.connection.send_failed",
                        source = "service-bin",
                        connection_id
                    );
                    break;
                }
            }
        }
    }
    event_forwarder.abort();
    tracing::info!(
        event_name = "session_socket.connection.close",
        source = "service-bin",
        connection_id
    );
}

fn handle_client_message(
    actor: &RuntimeActor,
    message: Message,
    watches: SharedWatchState,
    outbound: OutboundSender,
    connection_id: u64,
) -> bool {
    let Ok(text) = message.to_text() else {
        tracing::warn!(
            event_name = "session_socket.frame.non_text",
            source = "service-bin",
            connection_id
        );
        return false;
    };
    let frame = ClientCommandFrame::from_text(text);
    let actor = actor.clone();
    tokio::spawn(dispatch_client_frame(
        actor,
        frame,
        watches,
        outbound,
        connection_id,
    ));
    true
}

type SharedWatchState = Arc<Mutex<WatchState>>;
type OutboundSender = mpsc::UnboundedSender<OutboundFrame>;

#[derive(Debug)]
enum OutboundFrame {
    Event(ProductEvent),
    Response {
        id: String,
        response: Box<service_runtime::ConsumerResponse>,
    },
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Frame dispatch covers validation, actor dispatch, watch updates, and response telemetry."
)]
async fn dispatch_client_frame(
    actor: RuntimeActor,
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
        None => actor.dispatch(frame.command()).await,
    };
    if response.ok {
        watches
            .lock()
            .await
            .apply_command(&command_name, &response.result);
    }
    let duration_ms = started_at.elapsed().as_millis();
    if response.ok {
        tracing::info!(
            event_name = "session_socket.command.finish",
            source = "service-bin",
            connection_id,
            command_id = %id,
            command = %command_name,
            ok = true,
            duration_ms
        );
    } else {
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
            command_id = %id,
            command = %command_name,
            ok = false,
            duration_ms,
            error_code = %error_code,
            error_message = %error_message
        );
    }
    let _send_status = outbound.send(OutboundFrame::Response {
        id,
        response: Box::new(response),
    });
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Live-event forwarding intentionally gates on watches and handles backpressure/closure conditions."
)]
async fn forward_live_events(
    mut live_events: tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
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
                None
            } else {
                watches.product_event(&event)
            }
        };
        if let Some(event) = product_event
            && outbound.send(OutboundFrame::Event(event)).is_err()
        {
            tracing::warn!(
                event_name = "session_socket.events.send_failed",
                source = "service-bin",
                connection_id
            );
            return;
        }
    }
}

async fn send_outbound(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    outbound: OutboundFrame,
) -> std::result::Result<(), ()> {
    match outbound {
        OutboundFrame::Event(event) => send_event(sender, event).await,
        OutboundFrame::Response { id, response } => send_response(sender, id, *response).await,
    }
}

async fn send_response(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    id: String,
    response: service_runtime::ConsumerResponse,
) -> std::result::Result<(), ()> {
    let frame = ServerResponseFrame::new(id, response);
    let text = serde_json::to_string(&frame).map_err(|_error| ())?;
    sender
        .send(Message::Text(text.into()))
        .await
        .map_err(|_error| ())
}

async fn send_event(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    event: ProductEvent,
) -> std::result::Result<(), ()> {
    let frame = ServerEventFrame::new(event);
    let text = serde_json::to_string(&frame).map_err(|_error| ())?;
    sender
        .send(Message::Text(text.into()))
        .await
        .map_err(|_error| ())
}

#[derive(Debug, Default)]
struct WatchState {
    sessions: bool,
    timelines: HashSet<String>,
}

impl WatchState {
    fn has_watches(&self) -> bool {
        self.sessions || !self.timelines.is_empty()
    }

    fn apply_command(&mut self, command: &str, result: &serde_json::Value) {
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

    fn product_event(&self, event: &service_runtime::RuntimeEvent) -> Option<ProductEvent> {
        match event.kind {
            service_runtime::RuntimeEventKind::SessionsIndexChanged if self.sessions => {
                let revision = event.payload.get("revision")?.as_i64()?;
                Some(ProductEvent::SessionsIndexChanged { revision })
            }
            service_runtime::RuntimeEventKind::SessionTimelineChanged => {
                let open_session_id = event.payload.get("openSessionId")?.as_str()?;
                if !self.timelines.contains(open_session_id) {
                    return None;
                }
                let revision = event.payload.get("revision")?.as_i64()?;
                let items = event.payload.get("items").cloned();
                Some(ProductEvent::SessionTimelineChanged {
                    open_session_id: open_session_id.to_owned(),
                    revision,
                    items,
                })
            }
            _ => None,
        }
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum ProductEvent {
    SessionsIndexChanged {
        revision: i64,
    },
    SessionTimelineChanged {
        #[serde(rename = "openSessionId")]
        open_session_id: String,
        revision: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        items: Option<serde_json::Value>,
    },
}

#[cfg(test)]
mod tests;
