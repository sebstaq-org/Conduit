//! Prompt lane regression tests.

use super::RuntimeActor;
use acp_core::{
    ConnectionState, ProviderInitializeRequest, ProviderInitializeResponse,
    ProviderInitializeResult, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot, WireKind,
    WireStream,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{
    AgentCapabilities, Implementation, InitializeResponse, ProtocolVersion,
};
use serde_json::{Value, json};
use service_runtime::{ConsumerCommand, ProviderFactory, ProviderPort, Result, RuntimeError};
use session_store::{HistoryLimit, LocalStore, OpenSessionKey};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

type TestResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

#[derive(Clone)]
struct BlockingPromptFactory {
    release: Arc<(Mutex<bool>, Condvar)>,
    started: mpsc::Sender<String>,
}

struct BlockingPromptProvider {
    provider: ProviderId,
    release: Arc<(Mutex<bool>, Condvar)>,
    started: mpsc::Sender<String>,
}

#[derive(Clone, Default)]
struct LaneAffinityFactory;

struct LaneAffinityProvider {
    provider: ProviderId,
    sessions: HashSet<String>,
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn blocking_prompt_does_not_block_following_history_or_queue_same_session() -> TestResult<()>
{
    let path = test_db_path()?;
    let open_session_id = seed_open_session(&path, ProviderId::Codex, "session-1")?;
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
    let prompt = spawn_prompt(actor.clone(), "1", &open_session_id);
    let started_session = started_rx.recv_timeout(Duration::from_secs(5))?;

    let history = tokio::time::timeout(
        Duration::from_millis(250),
        actor.dispatch(command(
            "2",
            "session/history",
            "all",
            json!({
                "openSessionId": open_session_id,
                "limit": 8
            }),
        )),
    )
    .await?;
    let duplicate = actor
        .dispatch(prompt_command("3", "all", &open_session_id))
        .await;

    release_prompt(&release)?;
    let prompt = tokio::time::timeout(Duration::from_secs(5), prompt).await??;
    if started_session != "session-1" {
        return Err(format!("unexpected started session: {started_session}").into());
    }
    ensure_ok(&history)?;
    ensure_error_code(&duplicate, "session_prompt_active")?;
    ensure_ok(&prompt)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn new_session_prompt_does_not_block_following_history() -> TestResult<()> {
    let path = test_db_path()?;
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
    wait_for_actor_provider_ready(&actor, "codex").await?;
    let new_session = actor
        .dispatch(command(
            "1",
            "session/new",
            "codex",
            json!({ "cwd": "/repo", "limit": 8 }),
        ))
        .await;
    ensure_ok(&new_session)?;
    let open_session_id = new_session
        .result
        .get("history")
        .and_then(|history| history.get("openSessionId"))
        .and_then(Value::as_str)
        .ok_or("session/new missing openSessionId")?;
    let prompt = spawn_prompt(actor.clone(), "2", open_session_id);
    let started_session = started_rx.recv_timeout(Duration::from_secs(5))?;

    let history = tokio::time::timeout(
        Duration::from_millis(250),
        actor.dispatch(command(
            "3",
            "session/history",
            "all",
            json!({
                "openSessionId": open_session_id,
                "limit": 8
            }),
        )),
    )
    .await?;

    release_prompt(&release)?;
    let prompt = tokio::time::timeout(Duration::from_secs(5), prompt).await??;
    if started_session != "session-1" {
        return Err(format!("unexpected started session: {started_session}").into());
    }
    ensure_ok(&history)?;
    ensure_ok(&prompt)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn blocking_prompt_allows_out_of_band_interaction_responses() -> TestResult<()> {
    let path = test_db_path()?;
    let open_session_id = seed_open_session(&path, ProviderId::Codex, "session-1")?;
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
    let prompt = spawn_prompt(actor.clone(), "1", &open_session_id);
    let _started_session = started_rx.recv_timeout(Duration::from_secs(5))?;

    let interaction = tokio::time::timeout(
        Duration::from_millis(250),
        actor.dispatch(command(
            "2",
            "session/respond_interaction",
            "all",
            json!({
                "openSessionId": open_session_id,
                "interactionId": "interaction-1",
                "response": {
                    "kind": "selected",
                    "optionId": "answer-0"
                }
            }),
        )),
    )
    .await?;

    release_prompt(&release)?;
    let prompt = tokio::time::timeout(Duration::from_secs(5), prompt).await??;
    ensure_ok(&interaction)?;
    ensure_ok(&prompt)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn prompt_lanes_run_different_open_sessions_in_parallel() -> TestResult<()> {
    let path = test_db_path()?;
    let first_open_session_id = seed_open_session(&path, ProviderId::Codex, "session-1")?;
    let second_open_session_id = seed_open_session(&path, ProviderId::Codex, "session-2")?;
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
    let first_prompt = spawn_prompt(actor.clone(), "1", &first_open_session_id);
    let second_prompt = spawn_prompt(actor, "2", &second_open_session_id);
    let started_sessions = [
        started_rx.recv_timeout(Duration::from_secs(5))?,
        started_rx.recv_timeout(Duration::from_secs(5))?,
    ];

    release_prompt(&release)?;
    let first_prompt = tokio::time::timeout(Duration::from_secs(5), first_prompt).await??;
    let second_prompt = tokio::time::timeout(Duration::from_secs(5), second_prompt).await??;
    ensure_started_sessions(&started_sessions)?;
    ensure_ok(&first_prompt)?;
    ensure_ok(&second_prompt)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn session_set_config_option_uses_prompt_lane_owner_runtime() -> TestResult<()> {
    let path = test_db_path()?;
    let refresh_path = path.clone();
    let actor = RuntimeActor::start_with_store_opener(
        LaneAffinityFactory,
        LocalStore::open_path(&path)?,
        Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
    );
    wait_for_actor_provider_ready(&actor, "codex").await?;

    let session_new = actor
        .dispatch(command(
            "1",
            "session/new",
            "codex",
            json!({ "cwd": "/repo", "limit": 8 }),
        ))
        .await;
    ensure_ok(&session_new)?;
    let session_id = session_new
        .result
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or("session/new missing sessionId")?;

    let set_config = actor
        .dispatch(command(
            "2",
            "session/set_config_option",
            "codex",
            json!({
                "sessionId": session_id,
                "configId": "collaboration_mode",
                "value": "plan"
            }),
        ))
        .await;
    ensure_ok(&set_config)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn session_new_rejects_provider_session_owner_rebind() -> TestResult<()> {
    let path = test_db_path()?;
    let refresh_path = path.clone();
    let actor = RuntimeActor::start_with_store_opener(
        LaneAffinityFactory,
        LocalStore::open_path(&path)?,
        Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
    );
    wait_for_actor_provider_ready(&actor, "codex").await?;

    let first = actor
        .dispatch(command(
            "1",
            "session/new",
            "codex",
            json!({ "cwd": "/repo", "limit": 8 }),
        ))
        .await;
    ensure_ok(&first)?;

    let second = actor
        .dispatch(command(
            "2",
            "session/new",
            "codex",
            json!({ "cwd": "/repo", "limit": 8 }),
        ))
        .await;
    ensure_error_code(&second, "session_lane_conflict")
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

impl ProviderFactory for LaneAffinityFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(LaneAffinityProvider {
            provider,
            sessions: HashSet::new(),
        }))
    }
}

impl ProviderPort for BlockingPromptProvider {
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        Ok(test_initialize_result(request))
    }

    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        Ok(None)
    }

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

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        Ok(json!({ "sessionId": "session-1" }))
    }

    fn session_list(&mut self, _cwd: Option<PathBuf>, _cursor: Option<String>) -> Result<Value> {
        Ok(json!({ "sessions": [] }))
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        _prompt: Vec<Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<Value> {
        let _send_status = self.started.send(session_id.clone());
        let (released, condvar) = &*self.release;
        let mut released = released
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        while !*released {
            released = condvar
                .wait(released)
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        }
        update_sink(TranscriptUpdateSnapshot {
            index: 0,
            variant: "agent_message_chunk".to_owned(),
            update: json!({
                "sessionUpdate": "agent_message_chunk",
                "content": {
                    "type": "text",
                    "text": "agent reply"
                }
            }),
        });
        Ok(json!({ "sessionId": session_id, "stopReason": "end_turn" }))
    }

    fn session_cancel(&mut self, session_id: String) -> Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        _config_id: String,
        _value: String,
    ) -> Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "configOptions": []
        }))
    }

    fn session_respond_interaction(
        &mut self,
        session_id: String,
        interaction_id: String,
        response: acp_core::InteractionResponse,
    ) -> Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "interactionId": interaction_id,
            "response": format!("{response:?}")
        }))
    }
}

impl ProviderPort for LaneAffinityProvider {
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        Ok(test_initialize_result(request))
    }

    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        Ok(None)
    }

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
        Vec::new()
    }

    fn disconnect(&mut self) -> Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        let session_id = "session-1".to_owned();
        self.sessions.insert(session_id.clone());
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_list(&mut self, _cwd: Option<PathBuf>, _cursor: Option<String>) -> Result<Value> {
        Ok(json!({ "sessions": [] }))
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
        self.sessions.insert(session_id.clone());
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

    fn session_set_config_option(
        &mut self,
        session_id: String,
        _config_id: String,
        _value: String,
    ) -> Result<Value> {
        if !self.sessions.contains(&session_id) {
            return Err(RuntimeError::Provider(format!(
                "unknown session in runtime lane: {session_id}"
            )));
        }
        Ok(json!({
            "sessionId": session_id,
            "configOptions": []
        }))
    }

    fn session_respond_interaction(
        &mut self,
        session_id: String,
        interaction_id: String,
        _response: acp_core::InteractionResponse,
    ) -> Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "interactionId": interaction_id
        }))
    }
}

fn ensure_ok(response: &service_runtime::ConsumerResponse) -> TestResult<()> {
    if response.ok {
        return Ok(());
    }
    Err(format!("command failed: {:?}", response.error).into())
}

fn ensure_error_code(response: &service_runtime::ConsumerResponse, code: &str) -> TestResult<()> {
    if response.error.as_ref().map(|error| error.code.as_str()) == Some(code) {
        return Ok(());
    }
    Err(format!("unexpected response: {response:?}").into())
}

fn ensure_started_sessions(started_sessions: &[String; 2]) -> TestResult<()> {
    let mut started_sessions = started_sessions.to_vec();
    started_sessions.sort();
    if started_sessions == vec!["session-1".to_owned(), "session-2".to_owned()] {
        return Ok(());
    }
    Err(format!("unexpected started sessions: {started_sessions:?}").into())
}

async fn wait_for_actor_provider_ready(actor: &RuntimeActor, provider: &str) -> TestResult<()> {
    for attempt in 0..100 {
        let response = actor
            .dispatch(command(
                &format!("snapshot-{attempt}"),
                "providers/config_snapshot",
                "all",
                json!({}),
            ))
            .await;
        ensure_ok(&response)?;
        let entries = response
            .result
            .get("entries")
            .and_then(Value::as_array)
            .ok_or("providers/config_snapshot missing entries")?;
        let status = entries
            .iter()
            .find(|entry| entry.get("provider").and_then(Value::as_str) == Some(provider))
            .and_then(|entry| entry.get("status"))
            .and_then(Value::as_str);
        if status == Some("ready") {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    Err(format!("provider {provider} did not become ready").into())
}

fn seed_open_session(path: &PathBuf, provider: ProviderId, session_id: &str) -> TestResult<String> {
    let mut store = LocalStore::open_path(path)?;
    let opened = store.open_session(
        OpenSessionKey {
            provider,
            session_id: session_id.to_owned(),
            cwd: "/repo".to_owned(),
        },
        &[],
        HistoryLimit::new("test", Some(8))?,
    )?;
    Ok(opened.open_session_id)
}

fn spawn_prompt(
    actor: RuntimeActor,
    id: &'static str,
    open_session_id: &str,
) -> tokio::task::JoinHandle<service_runtime::ConsumerResponse> {
    let open_session_id = open_session_id.to_owned();
    tokio::spawn(async move {
        actor
            .dispatch(prompt_command(id, "all", &open_session_id))
            .await
    })
}

fn prompt_command(id: &str, provider: &str, open_session_id: &str) -> ConsumerCommand {
    command(
        id,
        "session/prompt",
        provider,
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": "user prompt" }]
        }),
    )
}

fn command(id: &str, command: &str, provider: &str, params: Value) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: command.to_owned(),
        provider: provider.to_owned(),
        params,
    }
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

fn test_initialize_result(request: ProviderInitializeRequest) -> ProviderInitializeResult {
    ProviderInitializeResult {
        request,
        response: ProviderInitializeResponse {
            protocol_version: ProtocolVersion::V1,
            agent_capabilities: AgentCapabilities::default(),
            agent_info: Some(Implementation::new("fake-agent", "0.5.0")),
            auth_methods: Vec::new(),
        },
    }
}

fn test_db_path() -> TestResult<PathBuf> {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!(
        "conduit-service-bin-prompt-lane-{}-{nanos}.sqlite3",
        std::process::id()
    )))
}
