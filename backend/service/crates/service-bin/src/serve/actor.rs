//! Single-owner runtime actor for WebSocket consumers.

use service_runtime::{
    AppServiceFactory, ConsumerCommand, ConsumerResponse, RuntimeEvent, ServiceRuntime,
};
use session_store::LocalStore;
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
    pub(crate) fn start(local_store: LocalStore) -> Self {
        Self::start_with_factory(AppServiceFactory::default(), local_store)
    }

    /// Starts one actor with an explicit provider factory.
    #[must_use]
    pub(crate) fn start_with_factory(factory: AppServiceFactory, local_store: LocalStore) -> Self {
        let (commands, receiver) = mpsc::channel(32);
        let (events, _) = broadcast::channel(256);
        tokio::spawn(run_actor(receiver, events.clone(), factory, local_store));
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
    factory: AppServiceFactory,
    local_store: LocalStore,
) {
    let mut runtime = ServiceRuntime::with_factory(factory, local_store);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    while let Some(request) = receiver.recv().await {
        handle_request(&mut runtime, request);
    }
}

fn handle_request(runtime: &mut ServiceRuntime, request: ActorRequest) {
    if request.command.command == "sessions/grouped" {
        handle_grouped_sessions_request(runtime, request);
        return;
    }
    let response = runtime.dispatch(request.command);
    let _response_status = request.respond_to.send(response);
}

fn handle_grouped_sessions_request(runtime: &mut ServiceRuntime, request: ActorRequest) {
    let command = request.command.clone();
    let response = runtime.dispatch(request.command);
    let _response_status = request.respond_to.send(response);
    let _refresh_result = runtime.refresh_after_response(&command);
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
