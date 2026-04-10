//! Single-owner runtime actor for WebSocket consumers.

use service_runtime::{ConsumerCommand, ConsumerResponse, RuntimeEvent, ServiceRuntime};
use tokio::sync::{broadcast, mpsc, oneshot};

#[derive(Debug)]
struct ActorRequest {
    command: ConsumerCommand,
    respond_to: oneshot::Sender<ConsumerResponse>,
}

/// Handle used by transports to enqueue runtime commands.
#[derive(Clone)]
pub(crate) struct RuntimeActor {
    commands: mpsc::Sender<ActorRequest>,
    events: broadcast::Sender<RuntimeEvent>,
}

impl RuntimeActor {
    /// Starts one actor that exclusively owns `ServiceRuntime`.
    #[must_use]
    pub(crate) fn start() -> Self {
        let (commands, receiver) = mpsc::channel(32);
        let (events, _) = broadcast::channel(256);
        tokio::spawn(run_actor(receiver, events.clone()));
        Self { commands, events }
    }

    /// Dispatches one command through the actor queue.
    pub(crate) async fn dispatch(&self, command: ConsumerCommand) -> ConsumerResponse {
        let id = command.id.clone();
        let (respond_to, response) = oneshot::channel();
        let request = ActorRequest {
            command,
            respond_to,
        };
        if self.commands.send(request).await.is_err() {
            return failure(id, "runtime_unavailable", "runtime actor is unavailable");
        }
        response
            .await
            .unwrap_or_else(|_| failure(id, "runtime_unavailable", "runtime actor stopped"))
    }

    /// Subscribes to live runtime events.
    pub(crate) fn subscribe(&self) -> broadcast::Receiver<RuntimeEvent> {
        self.events.subscribe()
    }
}

async fn run_actor(
    mut receiver: mpsc::Receiver<ActorRequest>,
    events: broadcast::Sender<RuntimeEvent>,
) {
    let mut runtime = ServiceRuntime::new();
    while let Some(request) = receiver.recv().await {
        handle_request(&mut runtime, &events, request);
    }
}

fn handle_request(
    runtime: &mut ServiceRuntime,
    events: &broadcast::Sender<RuntimeEvent>,
    request: ActorRequest,
) {
    let should_broadcast = request.command.command != "events/subscribe";
    let cursor = runtime.latest_event_sequence();
    let response = runtime.dispatch(request.command);
    let produced_events = runtime.events_after(cursor);
    let _response_status = request.respond_to.send(response);
    if should_broadcast {
        broadcast_events(events, produced_events);
    }
}

fn broadcast_events(events: &broadcast::Sender<RuntimeEvent>, produced_events: Vec<RuntimeEvent>) {
    for event in produced_events {
        let _subscriber_count = events.send(event);
    }
}

fn failure(id: String, code: &str, message: &str) -> ConsumerResponse {
    ConsumerResponse {
        id,
        ok: false,
        result: serde_json::Value::Null,
        error: Some(service_runtime::ConsumerError {
            code: code.to_owned(),
            message: message.to_owned(),
        }),
        snapshot: None,
    }
}
