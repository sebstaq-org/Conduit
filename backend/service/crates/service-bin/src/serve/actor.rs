//! Single-owner runtime actor for WebSocket consumers.

mod prompt_lanes;
mod provider_config_snapshot;
mod startup_hydration;
mod suggestion_refresh;

use self::prompt_lanes::{PromptLanes, cancel_provider_session, prompt_open_session_id};
use self::provider_config_snapshot::{
    ProviderConfigSnapshots, spawn_provider_config_snapshot_worker,
};
use self::startup_hydration::spawn_startup_hydration_worker;
use self::suggestion_refresh::spawn_suggestion_refresh_worker;
use service_runtime::{
    AppServiceFactory, ConsumerCommand, ConsumerResponse, ProviderFactory, RuntimeEvent,
    ServiceRuntime,
};
use session_store::LocalStore;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, mpsc, oneshot};

const STARTUP_HYDRATION_ENABLED: bool = !cfg!(test);

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
    pub(crate) fn start_with_factory<F>(factory: F, local_store: LocalStore) -> Self
    where
        F: Clone + ProviderFactory + 'static,
    {
        Self::start_with_store_opener(
            factory,
            local_store,
            Arc::new(crate::local_store::open_product_store),
        )
    }

    pub(super) fn start_with_store_opener<F>(
        factory: F,
        local_store: LocalStore,
        refresh_store: StoreOpener,
    ) -> Self
    where
        F: Clone + ProviderFactory + 'static,
    {
        let (commands, receiver) = mpsc::channel(32);
        let (events, _) = broadcast::channel(256);
        let store_lock = Arc::new(Mutex::new(()));
        let refreshes = RefreshWorker::start(
            factory.clone(),
            events.clone(),
            Arc::clone(&refresh_store),
            Arc::clone(&store_lock),
        );
        let provider_config_snapshots = spawn_provider_config_snapshot_worker(factory.clone());
        spawn_suggestion_refresh_worker(
            factory.clone(),
            events.clone(),
            Arc::clone(&refresh_store),
            Arc::clone(&store_lock),
        );
        if STARTUP_HYDRATION_ENABLED {
            spawn_startup_hydration_worker(
                factory.clone(),
                Arc::clone(&refresh_store),
                Arc::clone(&store_lock),
            );
        }
        tokio::spawn(run_actor(ActorContext {
            receiver,
            events: events.clone(),
            factory,
            local_store,
            store: refresh_store,
            store_lock,
            refreshes,
            provider_config_snapshots,
        }));
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

type StoreOpener = Arc<dyn Fn() -> crate::error::Result<LocalStore> + Send + Sync>;
type StoreLock = Arc<Mutex<()>>;

#[derive(Clone)]
struct RefreshWorker {
    requests: mpsc::UnboundedSender<RefreshRequest>,
}

#[derive(Clone)]
struct RefreshRequest {
    force: bool,
    provider_target: String,
}

impl RefreshWorker {
    fn start<F>(
        factory: F,
        events: broadcast::Sender<RuntimeEvent>,
        refresh_store: StoreOpener,
        store_lock: StoreLock,
    ) -> Self
    where
        F: ProviderFactory + 'static,
    {
        let (requests, receiver) = mpsc::unbounded_channel();
        tokio::spawn(run_refresh_worker(
            receiver,
            events,
            factory,
            refresh_store,
            store_lock,
        ));
        Self { requests }
    }

    fn request(&self, provider_target: &str) {
        self.send(provider_target, false);
    }

    fn force(&self, provider_target: &str) {
        self.send(provider_target, true);
    }

    fn send(&self, provider_target: &str, force: bool) {
        let _send_status = self.requests.send(RefreshRequest {
            force,
            provider_target: provider_target.to_owned(),
        });
    }
}

struct ActorContext<F> {
    receiver: mpsc::Receiver<ActorRequest>,
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    local_store: LocalStore,
    store: StoreOpener,
    store_lock: StoreLock,
    refreshes: RefreshWorker,
    provider_config_snapshots: ProviderConfigSnapshots,
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Actor bootstrap wires prompt lanes, runtime, event sink, and request loop in one place."
)]
async fn run_actor<F>(context: ActorContext<F>)
where
    F: Clone + ProviderFactory + 'static,
{
    let ActorContext {
        mut receiver,
        events,
        factory,
        local_store,
        store,
        store_lock,
        refreshes,
        provider_config_snapshots,
    } = context;
    let mut prompt_lanes = PromptLanes::new(
        factory.clone(),
        events.clone(),
        store,
        Arc::clone(&store_lock),
    );
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    tracing::info!(event_name = "runtime_actor.started", source = "service-bin");
    while let Some(request) = receiver.recv().await {
        handle_request(
            &mut runtime,
            request,
            &refreshes,
            &provider_config_snapshots,
            &mut prompt_lanes,
        );
    }
    tracing::warn!(event_name = "runtime_actor.stopped", source = "service-bin");
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Refresh worker handles bootstrap failures, runtime wiring, and request-drain loop."
)]
async fn run_refresh_worker<F>(
    mut receiver: mpsc::UnboundedReceiver<RefreshRequest>,
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    refresh_store: StoreOpener,
    store_lock: StoreLock,
) where
    F: ProviderFactory,
{
    let Ok(local_store) = refresh_store() else {
        tracing::error!(
            event_name = "refresh_worker.store_unavailable",
            source = "service-bin"
        );
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    tracing::info!(
        event_name = "refresh_worker.started",
        source = "service-bin"
    );
    while let Some(provider_target) = receiver.recv().await {
        refresh_index_targets(&mut runtime, &mut receiver, provider_target);
    }
    tracing::warn!(
        event_name = "refresh_worker.stopped",
        source = "service-bin"
    );
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Refresh batching coalesces queued requests and logs per-target refresh outcomes."
)]
fn refresh_index_targets<F>(
    runtime: &mut ServiceRuntime<F>,
    receiver: &mut mpsc::UnboundedReceiver<RefreshRequest>,
    request: RefreshRequest,
) where
    F: ProviderFactory,
{
    let mut provider_targets = HashSet::from([request.provider_target]);
    let mut force = request.force;
    while let Ok(request) = receiver.try_recv() {
        force |= request.force;
        provider_targets.insert(request.provider_target);
    }
    for provider_target in provider_targets {
        let refresh_status = if force {
            runtime.force_refresh_session_index(&provider_target)
        } else {
            runtime.refresh_after_response(&ConsumerCommand {
                id: "background-session-index-refresh".to_owned(),
                command: "sessions/grouped".to_owned(),
                provider: provider_target.clone(),
                params: serde_json::Value::Null,
            })
        };
        if let Err(error) = refresh_status {
            tracing::warn!(
                event_name = "refresh_worker.refresh_failed",
                source = "service-bin",
                provider_target = %provider_target,
                force,
                error_message = %error
            );
        } else {
            tracing::debug!(
                event_name = "refresh_worker.refresh_ok",
                source = "service-bin",
                provider_target = %provider_target,
                force
            );
        }
    }
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Runtime request routing dispatches several command classes with distinct handling paths."
)]
fn handle_request<F>(
    runtime: &mut ServiceRuntime<F>,
    request: ActorRequest,
    refreshes: &RefreshWorker,
    provider_config_snapshots: &ProviderConfigSnapshots,
    prompt_lanes: &mut PromptLanes<F>,
) where
    F: Clone + ProviderFactory + 'static,
{
    tracing::debug!(
        event_name = "runtime_actor.request",
        source = "service-bin",
        command_id = %request.command.id,
        command = %request.command.command,
        provider = %request.command.provider
    );
    if request.command.command == "providers/config_snapshot" {
        handle_provider_config_snapshot_request(request, provider_config_snapshots);
        return;
    }
    if request.command.command == "sessions/grouped" {
        handle_grouped_sessions_request(runtime, request, refreshes);
        return;
    }
    if request.command.command == "projects/add" {
        handle_project_add_request(runtime, request, refreshes);
        return;
    }
    if request.command.command == "session/new" {
        prompt_lanes.dispatch_new_session(request);
        return;
    }
    if let Some(open_session_id) = prompt_open_session_id(&request.command) {
        prompt_lanes.dispatch(&open_session_id, request);
        return;
    }
    if let Some(provider_session) = cancel_provider_session(&request.command)
        && let Some(lane) = prompt_lanes.owner_for_provider_session(&provider_session)
    {
        lane.dispatch_cancel(request);
        return;
    }
    let response = runtime.dispatch(request.command);
    let response_status = request.respond_to.send(response);
    if response_status.is_err() {
        tracing::warn!(
            event_name = "runtime_actor.response_channel_closed",
            source = "service-bin",
            command = "runtime.dispatch"
        );
    }
}

fn handle_provider_config_snapshot_request(
    request: ActorRequest,
    provider_config_snapshots: &ProviderConfigSnapshots,
) {
    let command_id = request.command.id.clone();
    let response = if request.command.provider != "all" {
        ConsumerResponse {
            id: command_id.clone(),
            ok: false,
            result: serde_json::Value::Null,
            error: Some(service_runtime::ConsumerError {
                code: "invalid_parameter".to_owned(),
                message: "providers/config_snapshot must target provider all".to_owned(),
            }),
            snapshot: None,
        }
    } else {
        match provider_config_snapshots.snapshot_value() {
            Ok(result) => ConsumerResponse {
                id: command_id.clone(),
                ok: true,
                result,
                error: None,
                snapshot: None,
            },
            Err(error) => failure(command_id.clone(), "contract_violation", &error.to_string()),
        }
    };
    let response_status = request.respond_to.send(response);
    if response_status.is_err() {
        tracing::warn!(
            event_name = "runtime_actor.response_channel_closed",
            source = "service-bin",
            command_id = %command_id,
            command = "providers/config_snapshot"
        );
    }
}

fn handle_project_add_request<F>(
    runtime: &mut ServiceRuntime<F>,
    request: ActorRequest,
    refreshes: &RefreshWorker,
) where
    F: ProviderFactory,
{
    let response = runtime.dispatch(request.command);
    if response.ok {
        refreshes.force("all");
    }
    let response_status = request.respond_to.send(response);
    if response_status.is_err() {
        tracing::warn!(
            event_name = "runtime_actor.response_channel_closed",
            source = "service-bin",
            command = "projects/add"
        );
    }
}

fn handle_grouped_sessions_request<F>(
    runtime: &mut ServiceRuntime<F>,
    request: ActorRequest,
    refreshes: &RefreshWorker,
) where
    F: ProviderFactory,
{
    let provider_target = request.command.provider.clone();
    let response = runtime.dispatch(request.command);
    let response_status = request.respond_to.send(response);
    if response_status.is_err() {
        tracing::warn!(
            event_name = "runtime_actor.response_channel_closed",
            source = "service-bin",
            command = "sessions/grouped",
            provider_target = %provider_target
        );
    }
    refreshes.request(&provider_target);
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

#[cfg(test)]
mod prompt_lane_tests;

#[cfg(test)]
mod tests;
