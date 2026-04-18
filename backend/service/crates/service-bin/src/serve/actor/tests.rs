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

#[derive(Clone)]
struct SnapshotIsolationFactory {
    snapshot_probe_started: Arc<Mutex<Option<mpsc::Sender<()>>>>,
}

struct SnapshotIsolationProvider {
    provider: ProviderId,
    snapshot_probe_started: Arc<Mutex<Option<mpsc::Sender<()>>>>,
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

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn provider_snapshot_probe_does_not_mutate_runtime_open_session_state() -> TestResult<()> {
    let path = test_db_path()?;
    let refresh_path = path.clone();
    let (started, started_rx) = mpsc::channel();
    let factory = SnapshotIsolationFactory {
        snapshot_probe_started: Arc::new(Mutex::new(Some(started))),
    };
    let mut local_store = LocalStore::open_path(&path)?;
    local_store.add_project("/repo")?;
    let actor = RuntimeActor::start_with_store_opener(
        factory,
        local_store,
        Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
    );
    started_rx.recv_timeout(Duration::from_secs(5))?;

    let grouped = actor
        .dispatch(command("1", "sessions/grouped", "all", json!({})))
        .await;
    ensure_ok(&grouped)?;
    let groups = grouped
        .result
        .get("groups")
        .and_then(Value::as_array)
        .ok_or("sessions/grouped missing groups array")?;
    if groups.len() != 1 {
        return Err(format!("expected one project group, got {groups:?}").into());
    }
    let sessions = groups[0]
        .get("sessions")
        .and_then(Value::as_array)
        .ok_or("sessions/grouped missing sessions array")?;
    if !sessions.is_empty() {
        return Err(
            format!("snapshot probe must not create visible session rows: {sessions:?}").into(),
        );
    }

    let history = actor
        .dispatch(command(
            "2",
            "session/history",
            "all",
            json!({ "openSessionId": "open-session-from-snapshot-probe" }),
        ))
        .await;
    if history.ok {
        return Err("session/history unexpectedly succeeded for probe session id".into());
    }
    Ok(())
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

impl ProviderFactory for SnapshotIsolationFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(SnapshotIsolationProvider {
            provider,
            snapshot_probe_started: Arc::clone(&self.snapshot_probe_started),
        }))
    }
}

impl ProviderPort for BlockingRefreshProvider {
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

    fn session_list(&mut self, _cwd: Option<PathBuf>, _cursor: Option<String>) -> Result<Value> {
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
            released = condvar
                .wait(released)
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
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
}

impl ProviderPort for SnapshotIsolationProvider {
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
        if let Some(started) = self
            .snapshot_probe_started
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?
            .take()
        {
            let _send_status = started.send(());
        }
        Ok(json!({
            "sessionId": format!("snapshot-probe-{}", self.provider.as_str()),
            "configOptions": []
        }))
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
        Ok(json!({
            "sessionId": session_id,
            "configOptions": []
        }))
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
        "conduit-service-bin-{}-{nanos}.sqlite3",
        std::process::id()
    )))
}
