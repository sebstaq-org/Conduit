//! WebSocket product service for the consumer runtime API.

mod actor;
mod wire;

use crate::error::Result;
use crate::local_store::open_product_store;
use actor::RuntimeActor;
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use session_store::LocalStore;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, mpsc};
use tower_http::cors::CorsLayer;
use wire::{ClientCommandFrame, ServerEventFrame, ServerResponseFrame};

#[derive(Clone)]
struct ServeState {
    actor: RuntimeActor,
}

const CATALOG_COMMANDS: [&str; 19] = [
    "initialize",
    "session/new",
    "session/prompt",
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
    "session/set_config_option",
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
    axum::serve(listener, router(open_product_store()?)).await?;
    Ok(())
}

fn router(local_store: LocalStore) -> Router {
    router_with_actor(RuntimeActor::start(local_store))
}

fn router_with_actor(actor: RuntimeActor) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/catalog", get(catalog))
        .route("/api/session", get(session_socket))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(ServeState { actor }))
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

async fn handle_socket(socket: WebSocket, state: Arc<ServeState>) {
    let (mut sender, mut receiver) = socket.split();
    let (outbound, mut outbound_receiver) = mpsc::unbounded_channel();
    let watches = Arc::new(Mutex::new(WatchState::default()));
    let event_forwarder = tokio::spawn(forward_live_events(
        state.actor.subscribe(),
        Arc::clone(&watches),
        outbound.clone(),
    ));
    loop {
        tokio::select! {
            message = receiver.next() => {
                let Some(Ok(message)) = message else {
                    break;
                };
                if !handle_client_message(&state.actor, message, Arc::clone(&watches), outbound.clone()) {
                    break;
                }
            }
            outbound = outbound_receiver.recv() => {
                let Some(outbound) = outbound else {
                    break;
                };
                if send_outbound(&mut sender, outbound).await.is_err() {
                    break;
                }
            }
        }
    }
    event_forwarder.abort();
}

fn handle_client_message(
    actor: &RuntimeActor,
    message: Message,
    watches: SharedWatchState,
    outbound: OutboundSender,
) -> bool {
    let Ok(text) = message.to_text() else {
        return false;
    };
    let frame = ClientCommandFrame::from_text(text);
    let actor = actor.clone();
    tokio::spawn(dispatch_client_frame(actor, frame, watches, outbound));
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

async fn dispatch_client_frame(
    actor: RuntimeActor,
    frame: ClientCommandFrame,
    watches: SharedWatchState,
    outbound: OutboundSender,
) {
    let command_name = frame.command_name().to_owned();
    let id = frame.id();
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
    let _send_status = outbound.send(OutboundFrame::Response {
        id,
        response: Box::new(response),
    });
}

async fn forward_live_events(
    mut live_events: tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
    watches: SharedWatchState,
    outbound: OutboundSender,
) {
    loop {
        let Ok(event) = live_events.recv().await else {
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
mod tests {
    use super::{OutboundFrame, WatchState, handle_client_message};
    use crate::serve::actor::RuntimeActor;
    use acp_core::{
        ConnectionState, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot, WireKind,
        WireStream,
    };
    use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
    use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
    use axum::extract::ws::Message;
    use serde_json::json;
    use service_runtime::{
        ProviderFactory, ProviderPort, Result, RuntimeError, RuntimeEvent, RuntimeEventKind,
    };
    use session_store::{HistoryLimit, LocalStore, OpenSessionKey};
    use std::error::Error;
    use std::path::PathBuf;
    use std::sync::mpsc;
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::mpsc as tokio_mpsc;

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[derive(Clone)]
    struct BlockingPromptFactory {
        release: Arc<(Mutex<bool>, Condvar)>,
        started: mpsc::Sender<()>,
    }

    struct BlockingPromptProvider {
        provider: ProviderId,
        release: Arc<(Mutex<bool>, Condvar)>,
        started: mpsc::Sender<()>,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn socket_handler_accepts_following_command_while_prompt_response_is_pending()
    -> TestResult<()> {
        let path = test_db_path()?;
        let open_session_id = seed_open_session(&path)?;
        let refresh_path = path.clone();
        let (started, started_rx) = mpsc::channel();
        let release = Arc::new((Mutex::new(false), Condvar::new()));
        let actor = RuntimeActor::start_with_store_opener(
            BlockingPromptFactory {
                release: Arc::clone(&release),
                started,
            },
            LocalStore::open_path(&path)?,
            Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
        );
        let watches = Arc::new(tokio::sync::Mutex::new(WatchState::default()));
        let (outbound, mut outbound_rx) = tokio_mpsc::unbounded_channel();

        if !handle_client_message(
            &actor,
            command_message(
                "prompt-1",
                "session/prompt",
                "all",
                prompt_params(&open_session_id),
            ),
            Arc::clone(&watches),
            outbound.clone(),
        ) {
            return Err("prompt frame was rejected".into());
        }
        started_rx.recv_timeout(Duration::from_secs(5))?;
        if !handle_client_message(
            &actor,
            command_message("watch-1", "sessions/watch", "all", json!({})),
            watches,
            outbound,
        ) {
            return Err("watch frame was rejected".into());
        }

        let response = tokio::time::timeout(Duration::from_millis(250), outbound_rx.recv()).await?;
        release_prompt(&release)?;
        ensure_response_id(response, "watch-1")
    }

    #[test]
    fn sessions_watch_projects_only_index_events() -> TestResult<()> {
        let mut watches = WatchState::default();
        watches.apply_command("sessions/watch", &json!({ "subscribed": true }));
        let event = runtime_event(
            RuntimeEventKind::SessionsIndexChanged,
            json!({ "revision": 4 }),
        )?;
        let product_event = watches.product_event(&event);

        if serde_json::to_value(product_event)?
            == json!({
                "kind": "sessions_index_changed",
                "revision": 4
            })
        {
            return Ok(());
        }
        Err("sessions watch did not project a minimal index event".into())
    }

    #[test]
    fn session_watch_filters_by_open_session_id() -> TestResult<()> {
        let mut watches = WatchState::default();
        watches.apply_command(
            "session/watch",
            &json!({
                "subscribed": true,
                "openSessionId": "open-session-1"
            }),
        );
        let ignored_event = runtime_event(
            RuntimeEventKind::SessionTimelineChanged,
            json!({
                "openSessionId": "open-session-2",
                "revision": 4
            }),
        )?;
        let projected_event = runtime_event(
            RuntimeEventKind::SessionTimelineChanged,
            json!({
                "openSessionId": "open-session-1",
                "revision": 5
            }),
        )?;
        let ignored = watches.product_event(&ignored_event);
        let projected = watches.product_event(&projected_event);

        if ignored.is_some() {
            return Err("session watch projected another open session".into());
        }
        if serde_json::to_value(projected)?
            == json!({
                "kind": "session_timeline_changed",
                "openSessionId": "open-session-1",
                "revision": 5
            })
        {
            return Ok(());
        }
        Err("session watch did not project a minimal timeline event".into())
    }

    fn runtime_event(
        kind: RuntimeEventKind,
        payload: serde_json::Value,
    ) -> TestResult<RuntimeEvent> {
        Ok(serde_json::from_value(json!({
            "sequence": 1,
            "kind": kind,
            "provider": "codex",
            "session_id": null,
            "payload": payload
        }))?)
    }

    impl ProviderFactory for BlockingPromptFactory {
        fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
            Ok(Box::new(BlockingPromptProvider {
                provider,
                release: Arc::clone(&self.release),
                started: self.started.clone(),
            }))
        }
    }

    impl ProviderPort for BlockingPromptProvider {
        fn snapshot(&self) -> ProviderSnapshot {
            ProviderSnapshot {
                provider: self.provider,
                connection_state: ConnectionState::Ready,
                discovery: fake_discovery(self.provider),
                capabilities: json!({}),
                auth_methods: Vec::new(),
                live_sessions: Vec::new(),
                last_prompt: None,
                loaded_transcripts: Vec::new(),
            }
        }

        fn raw_events(&self) -> Vec<RawWireEvent> {
            vec![RawWireEvent {
                sequence: 1,
                stream: WireStream::Outgoing,
                kind: WireKind::Request,
                payload: "{}".to_owned(),
                method: Some("session/prompt".to_owned()),
                request_id: Some("1".to_owned()),
                json: Some(json!({})),
            }]
        }

        fn disconnect(&mut self) -> Result<()> {
            Ok(())
        }

        fn session_new(&mut self, _cwd: PathBuf) -> Result<serde_json::Value> {
            Ok(json!({ "sessionId": "session-1" }))
        }

        fn session_list(
            &mut self,
            _cwd: Option<PathBuf>,
            _cursor: Option<String>,
        ) -> Result<serde_json::Value> {
            Ok(json!({ "sessions": [] }))
        }

        fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<serde_json::Value> {
            Ok(json!({ "sessionId": session_id }))
        }

        fn session_prompt(
            &mut self,
            session_id: String,
            _prompt: Vec<serde_json::Value>,
            _update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
        ) -> Result<serde_json::Value> {
            let _send_status = self.started.send(());
            let (released, condvar) = &*self.release;
            let mut released = released
                .lock()
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
            while !*released {
                released = condvar.wait(released).map_err(|error| {
                    RuntimeError::Provider(format!("fake state poisoned: {error}"))
                })?;
            }
            Ok(json!({ "sessionId": session_id, "stopReason": "end_turn" }))
        }

        fn session_cancel(&mut self, session_id: String) -> Result<serde_json::Value> {
            Ok(json!({ "sessionId": session_id }))
        }

        fn session_set_config_option(
            &mut self,
            session_id: String,
            _config_id: String,
            _value: String,
        ) -> Result<serde_json::Value> {
            Ok(json!({
                "sessionId": session_id,
                "configOptions": []
            }))
        }
    }

    fn ensure_response_id(response: Option<OutboundFrame>, expected_id: &str) -> TestResult<()> {
        match response {
            Some(OutboundFrame::Response { id, response }) if id == expected_id && response.ok => {
                Ok(())
            }
            Some(frame) => Err(format!("unexpected outbound frame: {frame:?}").into()),
            None => Err("outbound channel closed".into()),
        }
    }

    fn seed_open_session(path: &PathBuf) -> TestResult<String> {
        let mut store = LocalStore::open_path(path)?;
        let opened = store.open_session(
            OpenSessionKey {
                provider: ProviderId::Codex,
                session_id: "session-1".to_owned(),
                cwd: "/repo".to_owned(),
            },
            &[],
            HistoryLimit::new("test", Some(8))?,
        )?;
        Ok(opened.open_session_id)
    }

    fn command_message(
        id: &str,
        command: &str,
        provider: &str,
        params: serde_json::Value,
    ) -> Message {
        Message::Text(
            json!({
                "v": 1,
                "type": "command",
                "id": id,
                "command": {
                    "id": id,
                    "command": command,
                    "provider": provider,
                    "params": params
                }
            })
            .to_string()
            .into(),
        )
    }

    fn prompt_params(open_session_id: &str) -> serde_json::Value {
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": "user prompt" }]
        })
    }

    fn release_prompt(release: &Arc<(Mutex<bool>, Condvar)>) -> TestResult<()> {
        let (released, condvar) = &**release;
        *released.lock().map_err(|error| format!("{error}"))? = true;
        condvar.notify_all();
        Ok(())
    }

    fn fake_discovery(provider: ProviderId) -> ProviderDiscovery {
        ProviderDiscovery {
            provider,
            launcher: LauncherCommand {
                executable: PathBuf::from(provider.as_str()),
                args: Vec::new(),
                display: provider.as_str().to_owned(),
            },
            resolved_path: provider.as_str().to_owned(),
            version: "fake".to_owned(),
            auth_hints: Vec::new(),
            initialize_viable: true,
            transport_diagnostics: Vec::new(),
            initialize_probe: InitializeProbe {
                response: json!({}),
                payload: InitializeResponse::new(ProtocolVersion::V1)
                    .agent_info(Implementation::new("fake-agent", "0.5.0")),
                stdout_lines: Vec::new(),
                stderr_lines: Vec::new(),
                elapsed_ms: 1,
            },
        }
    }

    fn test_db_path() -> TestResult<PathBuf> {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        Ok(std::env::temp_dir().join(format!(
            "conduit-service-bin-socket-{}-{nanos}.sqlite3",
            std::process::id()
        )))
    }
}
