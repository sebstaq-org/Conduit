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
use std::pin::pin;
use std::sync::Arc;
use tokio::net::TcpListener;
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
            "session/open",
            "session/history",
            "session/watch",
            "session/prompt",
            "session/cancel",
            "provider/disconnect",
            "sessions/watch",
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
    let mut watches = WatchState::default();

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
                    &mut watches,
                ).await {
                    break;
                }
            }
            event = live_events.recv(), if watches.has_watches() => {
                let Ok(event) = event else {
                    break;
                };
                if let Some(event) = watches.product_event(&event)
                    && send_event(&mut sender, event).await.is_err()
                {
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
    watches: &mut WatchState,
) -> bool {
    let Ok(text) = message.to_text() else {
        return false;
    };
    let frame = ClientCommandFrame::from_text(text);
    let response = match frame.rejection() {
        Some(rejection) => rejection,
        None => {
            let Some(response) =
                dispatch_with_live_events(sender, actor, frame.command(), live_events, watches)
                    .await
            else {
                return false;
            };
            response
        }
    };
    if !send_buffered_live_events(sender, live_events, watches).await {
        return false;
    }
    if send_response(sender, frame.id(), response.clone())
        .await
        .is_err()
    {
        return false;
    }
    if response.ok {
        watches.apply_command(frame.command_name(), &response.result);
        if frame.command_name() == "sessions/watch" || frame.command_name() == "session/watch" {
            *live_events = live_events.resubscribe();
        }
    }
    true
}

async fn dispatch_with_live_events(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    actor: &RuntimeActor,
    command: service_runtime::ConsumerCommand,
    live_events: &mut tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
    watches: &WatchState,
) -> Option<service_runtime::ConsumerResponse> {
    let dispatch = actor.dispatch(command);
    let mut dispatch = pin!(dispatch);
    loop {
        tokio::select! {
            response = &mut dispatch => return Some(response),
            event = live_events.recv(), if watches.has_watches() => {
                let Ok(event) = event else {
                    return None;
                };
                if let Some(event) = watches.product_event(&event)
                    && send_event(sender, event).await.is_err()
                {
                    return None;
                }
            }
        }
    }
}

async fn send_buffered_live_events(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    live_events: &mut tokio::sync::broadcast::Receiver<service_runtime::RuntimeEvent>,
    watches: &WatchState,
) -> bool {
    loop {
        match live_events.try_recv() {
            Ok(event) => {
                if let Some(event) = watches.product_event(&event)
                    && send_event(sender, event).await.is_err()
                {
                    return false;
                }
            }
            Err(tokio::sync::broadcast::error::TryRecvError::Lagged(_)) => {}
            Err(tokio::sync::broadcast::error::TryRecvError::Empty) => return true,
            Err(tokio::sync::broadcast::error::TryRecvError::Closed) => return false,
        }
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
    use super::WatchState;
    use serde_json::json;
    use service_runtime::{RuntimeEvent, RuntimeEventKind};
    use std::error::Error;

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

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
}
