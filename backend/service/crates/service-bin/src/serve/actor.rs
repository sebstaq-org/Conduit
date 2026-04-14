//! Single-owner runtime actor for WebSocket consumers.

mod suggestion_refresh;

use self::suggestion_refresh::spawn_suggestion_refresh_worker;
use service_runtime::{
    AppServiceFactory, ConsumerCommand, ConsumerResponse, ProviderFactory, RuntimeEvent,
    ServiceRuntime,
};
use session_store::LocalStore;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
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
        spawn_suggestion_refresh_worker(
            factory.clone(),
            events.clone(),
            Arc::clone(&refresh_store),
            Arc::clone(&store_lock),
        );
        tokio::spawn(run_actor(ActorContext {
            receiver,
            events: events.clone(),
            factory,
            local_store,
            store: refresh_store,
            store_lock,
            refreshes,
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

struct PromptLanes<F> {
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    lanes: HashMap<String, PromptLane>,
    store: StoreOpener,
    store_lock: StoreLock,
}

impl<F> PromptLanes<F>
where
    F: Clone + ProviderFactory + 'static,
{
    fn new(
        factory: F,
        events: broadcast::Sender<RuntimeEvent>,
        store: StoreOpener,
        store_lock: StoreLock,
    ) -> Self {
        Self {
            events,
            factory,
            lanes: HashMap::new(),
            store,
            store_lock,
        }
    }

    fn dispatch(&mut self, open_session_id: &str, request: ActorRequest) {
        let lane = self.lane(open_session_id);
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
                )
            })
            .clone()
    }
}

#[derive(Clone)]
struct PromptLane {
    active: Arc<AtomicBool>,
    requests: mpsc::UnboundedSender<ActorRequest>,
}

impl PromptLane {
    fn start<F>(
        factory: F,
        events: broadcast::Sender<RuntimeEvent>,
        store: StoreOpener,
        store_lock: StoreLock,
    ) -> Self
    where
        F: ProviderFactory + 'static,
    {
        let active = Arc::new(AtomicBool::new(false));
        let (requests, receiver) = mpsc::unbounded_channel();
        tokio::spawn(run_prompt_lane(PromptLaneContext {
            receiver,
            events,
            factory,
            store,
            store_lock,
            active: Arc::clone(&active),
        }));
        Self { active, requests }
    }

    fn dispatch(&self, request: ActorRequest) {
        if self.active.swap(true, Ordering::AcqRel) {
            let id = request.command.id;
            let _response_status = request.respond_to.send(failure(
                id,
                "session_prompt_active",
                "session already has an active prompt turn",
            ));
            return;
        }
        if let Err(error) = self.requests.send(request) {
            self.active.store(false, Ordering::Release);
            let request = error.0;
            let id = request.command.id;
            let _response_status = request.respond_to.send(failure(
                id,
                "runtime_unavailable",
                "prompt lane is unavailable",
            ));
        }
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
}

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
    while let Some(request) = receiver.recv().await {
        handle_request(&mut runtime, request, &refreshes, &mut prompt_lanes);
    }
}

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
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    while let Some(provider_target) = receiver.recv().await {
        refresh_index_targets(&mut runtime, &mut receiver, provider_target);
    }
}

struct PromptLaneContext<F> {
    receiver: mpsc::UnboundedReceiver<ActorRequest>,
    events: broadcast::Sender<RuntimeEvent>,
    factory: F,
    store: StoreOpener,
    store_lock: StoreLock,
    active: Arc<AtomicBool>,
}

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
    } = context;
    let Ok(local_store) = store() else {
        fail_prompt_lane_requests(receiver, active).await;
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    while let Some(request) = receiver.recv().await {
        let response = runtime.dispatch(request.command);
        let _response_status = request.respond_to.send(response);
        active.store(false, Ordering::Release);
    }
}

async fn fail_prompt_lane_requests(
    mut receiver: mpsc::UnboundedReceiver<ActorRequest>,
    active: Arc<AtomicBool>,
) {
    while let Some(request) = receiver.recv().await {
        let id = request.command.id;
        let _response_status = request.respond_to.send(failure(
            id,
            "runtime_unavailable",
            "prompt lane store is unavailable",
        ));
        active.store(false, Ordering::Release);
    }
}

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
        let _refresh_status = if force {
            runtime.force_refresh_session_index(&provider_target)
        } else {
            runtime.refresh_after_response(&ConsumerCommand {
                id: "background-session-index-refresh".to_owned(),
                command: "sessions/grouped".to_owned(),
                provider: provider_target,
                params: serde_json::Value::Null,
            })
        };
    }
}

fn handle_request<F>(
    runtime: &mut ServiceRuntime<F>,
    request: ActorRequest,
    refreshes: &RefreshWorker,
    prompt_lanes: &mut PromptLanes<F>,
) where
    F: Clone + ProviderFactory + 'static,
{
    if request.command.command == "sessions/grouped" {
        handle_grouped_sessions_request(runtime, request, refreshes);
        return;
    }
    if request.command.command == "projects/add" {
        handle_project_add_request(runtime, request, refreshes);
        return;
    }
    if let Some(open_session_id) = prompt_open_session_id(&request.command) {
        if runtime.open_session_is_live(&open_session_id) {
            let response = runtime.dispatch(request.command);
            let _response_status = request.respond_to.send(response);
            return;
        }
        prompt_lanes.dispatch(&open_session_id, request);
        return;
    }
    let response = runtime.dispatch(request.command);
    let _response_status = request.respond_to.send(response);
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
    let _response_status = request.respond_to.send(response);
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
    let _response_status = request.respond_to.send(response);
    refreshes.request(&provider_target);
}

fn prompt_open_session_id(command: &ConsumerCommand) -> Option<String> {
    if command.command != "session/prompt" {
        return None;
    }
    command
        .params
        .get("openSessionId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
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
mod tests {
    use super::RuntimeActor;
    use acp_core::{
        ConnectionState, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot, WireKind,
        WireStream,
    };
    use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
    use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
    use serde_json::{Value, json};
    use service_runtime::{ConsumerCommand, ProviderFactory, ProviderPort, Result, RuntimeError};
    use session_store::LocalStore;
    use std::path::PathBuf;
    use std::sync::mpsc;
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    type TestResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

    #[derive(Clone)]
    struct BlockingRefreshFactory {
        release: Arc<(Mutex<bool>, Condvar)>,
        started: Arc<Mutex<Option<mpsc::Sender<()>>>>,
    }

    struct BlockingRefreshProvider {
        provider: ProviderId,
        release: Arc<(Mutex<bool>, Condvar)>,
        started: Arc<Mutex<Option<mpsc::Sender<()>>>>,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn grouped_refresh_does_not_block_following_open_session() -> TestResult<()> {
        let path = test_db_path()?;
        let refresh_path = path.clone();
        let (started, started_rx) = mpsc::channel();
        let release = Arc::new((Mutex::new(false), Condvar::new()));
        let factory = BlockingRefreshFactory {
            release: Arc::clone(&release),
            started: Arc::new(Mutex::new(Some(started))),
        };
        let mut local_store = LocalStore::open_path(&path)?;
        local_store.add_project("/repo")?;
        let actor = RuntimeActor::start_with_store_opener(
            factory,
            local_store,
            Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
        );
        let grouped = actor
            .dispatch(command("1", "sessions/grouped", "codex", json!({})))
            .await;
        started_rx.recv_timeout(Duration::from_secs(5))?;

        let opened = tokio::time::timeout(
            Duration::from_millis(250),
            actor.dispatch(command(
                "2",
                "session/open",
                "codex",
                json!({
                    "sessionId": "session-1",
                    "cwd": "/repo",
                    "limit": 8
                }),
            )),
        )
        .await;

        release_refresh(&release)?;
        let opened = opened?;
        ensure_ok(&grouped)?;
        ensure_ok(&opened)
    }

    impl ProviderFactory for BlockingRefreshFactory {
        fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
            Ok(Box::new(BlockingRefreshProvider {
                provider,
                release: Arc::clone(&self.release),
                started: Arc::clone(&self.started),
            }))
        }
    }

    impl ProviderPort for BlockingRefreshProvider {
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
                method: Some("session/list".to_owned()),
                request_id: Some("1".to_owned()),
                json: Some(json!({})),
            }]
        }

        fn disconnect(&mut self) -> Result<()> {
            Ok(())
        }

        fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
            Ok(json!({ "sessionId": "session-1" }))
        }

        fn session_list(
            &mut self,
            _cwd: Option<PathBuf>,
            _cursor: Option<String>,
        ) -> Result<Value> {
            if let Some(started) = self
                .started
                .lock()
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?
                .take()
            {
                let _send_status = started.send(());
            }
            let (released, condvar) = &*self.release;
            let mut released = released
                .lock()
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
            while !*released {
                released = condvar.wait(released).map_err(|error| {
                    RuntimeError::Provider(format!("fake state poisoned: {error}"))
                })?;
            }
            Ok(json!({ "sessions": [] }))
        }

        fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
            Ok(json!({ "sessionId": session_id }))
        }

        fn session_prompt(
            &mut self,
            session_id: String,
            _prompt: Vec<Value>,
            _update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
        ) -> Result<Value> {
            Ok(json!({ "sessionId": session_id, "stopReason": "end_turn" }))
        }

        fn session_cancel(&mut self, session_id: String) -> Result<Value> {
            Ok(json!({ "sessionId": session_id }))
        }
    }

    fn release_refresh(release: &Arc<(Mutex<bool>, Condvar)>) -> TestResult<()> {
        let (released, condvar) = &**release;
        *released.lock().map_err(|error| format!("{error}"))? = true;
        condvar.notify_all();
        Ok(())
    }

    fn ensure_ok(response: &service_runtime::ConsumerResponse) -> TestResult<()> {
        if response.ok {
            return Ok(());
        }
        Err(format!("command failed: {:?}", response.error).into())
    }

    fn command(id: &str, command: &str, provider: &str, params: Value) -> ConsumerCommand {
        ConsumerCommand {
            id: id.to_owned(),
            command: command.to_owned(),
            provider: provider.to_owned(),
            params,
        }
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
            "conduit-service-bin-{}-{nanos}.sqlite3",
            std::process::id()
        )))
    }
}
