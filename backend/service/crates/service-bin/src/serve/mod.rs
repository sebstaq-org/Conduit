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
use service_runtime::AppServiceFactory;
use session_store::LocalStore;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use wire::{ClientCommandFrame, ServerEventFrame, ServerResponseFrame};

#[derive(Clone)]
struct ServeState {
    actor: RuntimeActor,
}

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

pub(crate) struct ProofServer {
    pub(crate) address: SocketAddr,
    handle: JoinHandle<()>,
}

impl Drop for ProofServer {
    fn drop(&mut self) {
        self.handle.abort();
    }
}

pub(crate) async fn spawn_proof_server(
    factory: AppServiceFactory,
    local_store: LocalStore,
) -> Result<ProofServer> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let address = listener.local_addr()?;
    let app = router_with_actor(RuntimeActor::start_with_factory(factory, local_store));
    let handle = tokio::spawn(async move {
        let _result = axum::serve(listener, app).await;
    });
    Ok(ProofServer { address, handle })
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
        "commands": [
            "initialize",
            "session/new",
            "session/list",
            "session/load",
            "session/open",
            "session/history",
            "session/prompt",
            "session/cancel",
            "snapshot/get",
            "provider/disconnect",
            "events/subscribe",
            "sessions/grouped"
        ],
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
    let mut live_events = state.actor.subscribe();
    let mut subscribed = false;

    loop {
        tokio::select! {
            message = receiver.next() => {
                let Some(Ok(message)) = message else {
                    break;
                };
                if !handle_client_message(
                    &mut sender,
                    &state.actor,
                    message,
                    &mut live_events,
                    &mut subscribed,
                ).await {
                    break;
                }
            }
            event = live_events.recv(), if subscribed => {
                let Ok(event) = event else {
                    break;
                };
                if send_event(&mut sender, event).await.is_err() {
                    break;
                }
            }
        }
    }
}

async fn handle_client_message(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    actor: &RuntimeActor,
    message: Message,
    live_events: &mut tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
    subscribed: &mut bool,
) -> bool {
    let Ok(text) = message.to_text() else {
        return false;
    };
    let frame = ClientCommandFrame::from_text(text);
    let response = match frame.rejection() {
        Some(rejection) => rejection,
        None => actor.dispatch(frame.command()).await,
    };
    if send_response(sender, frame.id(), response.clone())
        .await
        .is_err()
    {
        return false;
    }
    if frame.command_name() == "events/subscribe" {
        *live_events = live_events.resubscribe();
        *subscribed = true;
        return send_backlog(sender, &response.result, live_events).await;
    }
    true
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

async fn send_backlog(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    result: &serde_json::Value,
    live_events: &mut tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
) -> bool {
    let events = backlog_events(result);
    discard_buffered_live_events(live_events);
    for event in events {
        if send_event(sender, event).await.is_err() {
            return false;
        }
    }
    true
}

fn backlog_events(result: &serde_json::Value) -> Vec<service_runtime::RuntimeEvent> {
    result
        .get("events")
        .cloned()
        .and_then(|value| serde_json::from_value::<Vec<service_runtime::RuntimeEvent>>(value).ok())
        .unwrap_or_default()
}

fn discard_buffered_live_events(
    live_events: &mut tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
) {
    loop {
        match live_events.try_recv() {
            Ok(_) | Err(tokio::sync::broadcast::error::TryRecvError::Lagged(_)) => {}
            Err(tokio::sync::broadcast::error::TryRecvError::Empty) => break,
            Err(tokio::sync::broadcast::error::TryRecvError::Closed) => break,
        }
    }
}

async fn send_event(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    event: service_runtime::RuntimeEvent,
) -> std::result::Result<(), ()> {
    let frame = ServerEventFrame::new(event);
    let text = serde_json::to_string(&frame).map_err(|_error| ())?;
    sender
        .send(Message::Text(text.into()))
        .await
        .map_err(|_error| ())
}

#[cfg(test)]
mod tests {
    use super::{backlog_events, discard_buffered_live_events};
    use acp_discovery::ProviderId;
    use serde_json::{Value, json, to_value};
    use service_runtime::{RuntimeEvent, RuntimeEventKind};
    use std::error::Error;
    use tokio::sync::broadcast;

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[test]
    fn backlog_events_deserialize_from_subscribe_result() -> TestResult<()> {
        let event = runtime_event(1, RuntimeEventKind::ProviderConnected);
        let result = json!({ "events": [to_value(&event)?] });
        let events = backlog_events(&result);

        if events != vec![event] {
            return Err("events/subscribe backlog did not deserialize".into());
        }
        Ok(())
    }

    #[test]
    fn buffered_live_events_are_discarded_before_backlog_replay() -> TestResult<()> {
        let (events, mut receiver) = broadcast::channel(8);
        let stale = runtime_event(1, RuntimeEventKind::ProviderConnected);
        let fresh = runtime_event(2, RuntimeEventKind::PromptStarted);

        let _subscribers = events.send(stale.clone())?;
        discard_buffered_live_events(&mut receiver);
        let _subscribers = events.send(fresh.clone())?;

        let received = receiver.try_recv()?;
        if received != fresh {
            return Err("stale event was not discarded before backlog replay".into());
        }
        if receiver.try_recv().is_ok() {
            return Err("expected exactly one live event after stale discard".into());
        }
        Ok(())
    }

    fn runtime_event(sequence: u64, kind: RuntimeEventKind) -> RuntimeEvent {
        RuntimeEvent {
            sequence,
            kind,
            provider: ProviderId::Codex,
            session_id: None,
            payload: Value::Null,
        }
    }
}
