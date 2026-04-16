use super::{ActorRequest, StoreLock, StoreOpener, failure};
use service_runtime::{
    ConsumerCommand, ConsumerResponse, ProviderFactory, RuntimeEvent, ServiceRuntime,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, mpsc};

type PromptLaneOwnerRoutes = Arc<Mutex<PromptLaneOwners>>;

#[derive(Default)]
struct PromptLaneOwners {
    open_sessions: HashMap<String, PromptLane>,
    provider_sessions: HashMap<(String, String), PromptLane>,
}

pub(super) struct PromptLanes<F> {
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    lanes: HashMap<String, PromptLane>,
    owners: PromptLaneOwnerRoutes,
    store: StoreOpener,
    store_lock: StoreLock,
}

impl<F> PromptLanes<F>
where
    F: Clone + ProviderFactory + 'static,
{
    pub(super) fn new(
        factory: F,
        events: broadcast::Sender<RuntimeEvent>,
        store: StoreOpener,
        store_lock: StoreLock,
    ) -> Self {
        Self {
            events,
            factory,
            lanes: HashMap::new(),
            owners: Arc::new(Mutex::new(PromptLaneOwners::default())),
            store,
            store_lock,
        }
    }

    pub(super) fn dispatch(&mut self, open_session_id: &str, request: ActorRequest) {
        let lane = self
            .owner_for_open_session(open_session_id)
            .unwrap_or_else(|| self.lane(open_session_id));
        self.register_open_session_owner(open_session_id, &lane);
        self.register_provider_session_owner_for_open_session(open_session_id, &lane);
        lane.dispatch(request);
    }

    pub(super) fn dispatch_new_session(&mut self, request: ActorRequest) {
        let lane_id = format!("session/new:{}", request.command.id);
        let lane = self.lane(&lane_id);
        lane.dispatch(request);
    }

    fn lane(&mut self, open_session_id: &str) -> PromptLane {
        self.lanes
            .entry(open_session_id.to_owned())
            .or_insert_with(|| {
                PromptLane::start(
                    self.factory.clone(),
                    self.events.clone(),
                    Arc::clone(&self.store),
                    Arc::clone(&self.store_lock),
                    Arc::clone(&self.owners),
                )
            })
            .clone()
    }

    fn owner_for_open_session(&self, open_session_id: &str) -> Option<PromptLane> {
        self.owners
            .lock()
            .ok()?
            .open_sessions
            .get(open_session_id)
            .cloned()
    }

    pub(super) fn owner_for_provider_session(&self, key: &(String, String)) -> Option<PromptLane> {
        self.owners.lock().ok()?.provider_sessions.get(key).cloned()
    }

    fn register_open_session_owner(&self, open_session_id: &str, lane: &PromptLane) {
        if let Ok(mut owners) = self.owners.lock() {
            owners
                .open_sessions
                .insert(open_session_id.to_owned(), lane.clone());
        }
    }

    fn register_provider_session_owner_for_open_session(
        &self,
        open_session_id: &str,
        lane: &PromptLane,
    ) {
        let Ok(_store_lock) = self.store_lock.lock() else {
            return;
        };
        let Ok(local_store) = (self.store)() else {
            return;
        };
        let Ok(key) = local_store.open_session_key("session/prompt", open_session_id) else {
            return;
        };
        if let Ok(mut owners) = self.owners.lock() {
            owners.provider_sessions.insert(
                (key.provider.as_str().to_owned(), key.session_id),
                lane.clone(),
            );
        }
    }
}

#[derive(Clone)]
pub(super) struct PromptLane {
    active: Arc<AtomicBool>,
    requests: mpsc::UnboundedSender<ActorRequest>,
}

impl PromptLane {
    fn start<F>(
        factory: F,
        events: broadcast::Sender<RuntimeEvent>,
        store: StoreOpener,
        store_lock: StoreLock,
        owners: PromptLaneOwnerRoutes,
    ) -> Self
    where
        F: ProviderFactory + 'static,
    {
        let active = Arc::new(AtomicBool::new(false));
        let (requests, receiver) = mpsc::unbounded_channel();
        let lane = Self {
            active: Arc::clone(&active),
            requests,
        };
        tokio::spawn(run_prompt_lane(PromptLaneContext {
            receiver,
            events,
            factory,
            store,
            store_lock,
            active: Arc::clone(&active),
            owners,
            owner_lane: lane.clone(),
        }));
        lane
    }

    #[allow(
        clippy::cognitive_complexity,
        reason = "Prompt-lane dispatch must handle active-lane and channel-failure branches inline."
    )]
    fn dispatch(&self, request: ActorRequest) {
        if self.active.swap(true, Ordering::AcqRel) {
            let id = request.command.id;
            let response_status = request.respond_to.send(failure(
                id,
                "session_prompt_active",
                "session already has an active prompt turn",
            ));
            if response_status.is_err() {
                tracing::warn!(
                    event_name = "prompt_lane.response_channel_closed",
                    source = "service-bin",
                    command = "session/prompt"
                );
            }
            return;
        }
        if let Err(error) = self.requests.send(request) {
            self.active.store(false, Ordering::Release);
            let request = error.0;
            let id = request.command.id;
            let response_status = request.respond_to.send(failure(
                id,
                "runtime_unavailable",
                "prompt lane is unavailable",
            ));
            if response_status.is_err() {
                tracing::warn!(
                    event_name = "prompt_lane.response_channel_closed",
                    source = "service-bin",
                    command = "session/prompt"
                );
            }
        }
    }

    pub(super) fn dispatch_cancel(&self, request: ActorRequest) {
        if self.active.load(Ordering::Acquire) {
            let id = request.command.id;
            let response_status = request.respond_to.send(failure(
                id,
                "session_cancel_active_unavailable",
                "active prompt cancellation is unavailable for this local provider owner",
            ));
            if response_status.is_err() {
                tracing::warn!(
                    event_name = "prompt_lane.response_channel_closed",
                    source = "service-bin",
                    command = "session/cancel"
                );
            }
            return;
        }
        self.dispatch(request);
    }
}

struct PromptLaneContext<F> {
    receiver: mpsc::UnboundedReceiver<ActorRequest>,
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    store: StoreOpener,
    store_lock: StoreLock,
    active: Arc<AtomicBool>,
    owners: PromptLaneOwnerRoutes,
    owner_lane: PromptLane,
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Lane loop coordinates runtime dispatch, ownership updates, and response-channel handling."
)]
async fn run_prompt_lane<F>(context: PromptLaneContext<F>)
where
    F: ProviderFactory,
{
    let PromptLaneContext {
        mut receiver,
        events,
        factory,
        store,
        store_lock,
        active,
        owners,
        owner_lane,
    } = context;
    let Ok(local_store) = store() else {
        tracing::error!(
            event_name = "prompt_lane.store_unavailable",
            source = "service-bin"
        );
        fail_prompt_lane_requests(receiver, active).await;
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    tracing::info!(event_name = "prompt_lane.started", source = "service-bin");
    while let Some(request) = receiver.recv().await {
        let command = request.command.clone();
        let response = runtime.dispatch(request.command);
        register_prompt_lane_owner_from_response(&owners, &owner_lane, &command, &response);
        let response_status = request.respond_to.send(response);
        if response_status.is_err() {
            tracing::warn!(
                event_name = "prompt_lane.response_channel_closed",
                source = "service-bin",
                command = %command.command
            );
        }
        active.store(false, Ordering::Release);
    }
    tracing::warn!(event_name = "prompt_lane.stopped", source = "service-bin");
}

async fn fail_prompt_lane_requests(
    mut receiver: mpsc::UnboundedReceiver<ActorRequest>,
    active: Arc<AtomicBool>,
) {
    while let Some(request) = receiver.recv().await {
        let id = request.command.id;
        let response_status = request.respond_to.send(failure(
            id,
            "runtime_unavailable",
            "prompt lane store is unavailable",
        ));
        if response_status.is_err() {
            tracing::warn!(
                event_name = "prompt_lane.response_channel_closed",
                source = "service-bin",
                command = "session/prompt"
            );
        }
        active.store(false, Ordering::Release);
    }
}

pub(super) fn prompt_open_session_id(command: &ConsumerCommand) -> Option<String> {
    if command.command != "session/prompt" {
        return None;
    }
    command
        .params
        .get("openSessionId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
}

pub(super) fn cancel_provider_session(command: &ConsumerCommand) -> Option<(String, String)> {
    if command.command != "session/cancel" {
        return None;
    }
    let session_id = command
        .params
        .get("session_id")
        .and_then(serde_json::Value::as_str)?
        .to_owned();
    Some((command.provider.clone(), session_id))
}

fn register_prompt_lane_owner_from_response(
    owners: &PromptLaneOwnerRoutes,
    lane: &PromptLane,
    command: &ConsumerCommand,
    response: &ConsumerResponse,
) {
    if command.command != "session/new" || !response.ok {
        return;
    }
    let Some(session_id) = response
        .result
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
    else {
        return;
    };
    let Some(open_session_id) = response
        .result
        .get("history")
        .and_then(|history| history.get("openSessionId"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
    else {
        return;
    };
    if let Ok(mut owners) = owners.lock() {
        owners.open_sessions.insert(open_session_id, lane.clone());
        owners
            .provider_sessions
            .insert((command.provider.clone(), session_id), lane.clone());
    }
}
