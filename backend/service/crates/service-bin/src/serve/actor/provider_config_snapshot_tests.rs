use super::{
    PROVIDER_CONFIG_SNAPSHOT_INTERVAL, ProviderConfigSnapshots,
    run_provider_config_snapshot_worker_with_wait, spawn_provider_config_snapshot_worker,
};
use acp_core::{
    ConnectionState, ProviderInitializeRequest, ProviderInitializeResponse,
    ProviderInitializeResult, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{
    AgentCapabilities, Implementation, InitializeResponse, ProtocolVersion,
};
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, ProviderPort, Result, RuntimeError};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::{Duration, Instant};

#[test]
fn worker_uses_six_hour_interval() {
    assert_eq!(
        PROVIDER_CONFIG_SNAPSHOT_INTERVAL,
        Duration::from_secs(6 * 60 * 60)
    );
}

#[test]
fn worker_refreshes_on_startup_and_each_interval_tick() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let mut factory = SnapshotProbeFactory {
        calls: Arc::clone(&calls),
    };
    let snapshots = ProviderConfigSnapshots::new();
    let mut waits = Vec::new();
    let mut ticks = 0_u8;
    run_provider_config_snapshot_worker_with_wait(
        &mut factory,
        &snapshots,
        Duration::from_secs(21_600),
        |interval| {
            waits.push(interval);
            if ticks == 0 {
                ticks = 1;
                return true;
            }
            false
        },
    );
    let probed_lock = calls.lock();
    assert!(probed_lock.is_ok(), "snapshot calls lock");
    let probed = probed_lock.map(|locked| locked.clone()).unwrap_or_default();
    assert_eq!(probed.len(), 12);
    assert_eq!(
        probed,
        vec![
            (ProviderId::Claude, "initialize".to_owned()),
            (ProviderId::Claude, "session/new".to_owned()),
            (ProviderId::Copilot, "initialize".to_owned()),
            (ProviderId::Copilot, "session/new".to_owned()),
            (ProviderId::Codex, "initialize".to_owned()),
            (ProviderId::Codex, "session/new".to_owned()),
            (ProviderId::Claude, "initialize".to_owned()),
            (ProviderId::Claude, "session/new".to_owned()),
            (ProviderId::Copilot, "initialize".to_owned()),
            (ProviderId::Copilot, "session/new".to_owned()),
            (ProviderId::Codex, "initialize".to_owned()),
            (ProviderId::Codex, "session/new".to_owned()),
        ],
    );
    let snapshot = snapshots.snapshot_value();
    let entries = snapshot["entries"].as_array();
    assert!(entries.is_some(), "snapshot entries array");
    let entries = entries.cloned().unwrap_or_default();
    assert_eq!(entries.len(), 3);
    for (entry, provider) in entries.into_iter().zip(["claude", "copilot", "codex"]) {
        assert_eq!(entry["provider"], json!(provider));
        assert_eq!(entry["status"], json!("ready"));
        assert_eq!(entry["configOptions"], json!([]));
        assert_eq!(entry["modes"], Value::Null);
        assert_eq!(entry["models"], Value::Null);
        assert!(entry["fetchedAt"].as_str().is_some());
        assert_eq!(entry["error"], Value::Null);
    }
    assert_eq!(
        waits,
        vec![Duration::from_secs(21_600), Duration::from_secs(21_600)],
    );
}

#[test]
fn startup_request_can_observe_loading_before_initial_refresh_finishes() {
    let (session_new_started_sender, session_new_started_receiver) = mpsc::channel();
    let (release_sender, release_receiver) = mpsc::channel();
    let snapshots = spawn_provider_config_snapshot_worker(StartupRaceSnapshotProbeFactory {
        release_receiver: Some(release_receiver),
        session_new_started_sender: Some(session_new_started_sender),
    });

    let started_provider = receive_started_provider(&session_new_started_receiver);
    assert_eq!(started_provider, ProviderId::Claude);

    assert_loading_snapshot(&snapshots);

    release_initial_probe(release_sender);
    assert_ready_snapshot(wait_for_ready_snapshot(&snapshots));
}

#[derive(Clone)]
struct SnapshotProbeFactory {
    calls: Arc<Mutex<Vec<(ProviderId, String)>>>,
}

struct SnapshotProbePort {
    provider: ProviderId,
    calls: Arc<Mutex<Vec<(ProviderId, String)>>>,
}

struct StartupRaceSnapshotProbeFactory {
    release_receiver: Option<mpsc::Receiver<()>>,
    session_new_started_sender: Option<mpsc::Sender<ProviderId>>,
}

struct StartupRaceSnapshotProbePort {
    provider: ProviderId,
    release_receiver: Option<mpsc::Receiver<()>>,
    session_new_started_sender: Option<mpsc::Sender<ProviderId>>,
}

impl ProviderFactory for SnapshotProbeFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(SnapshotProbePort {
            provider,
            calls: Arc::clone(&self.calls),
        }))
    }
}

impl ProviderFactory for StartupRaceSnapshotProbeFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(StartupRaceSnapshotProbePort {
            provider,
            release_receiver: if provider == ProviderId::Claude {
                self.release_receiver.take()
            } else {
                None
            },
            session_new_started_sender: if provider == ProviderId::Claude {
                self.session_new_started_sender.take()
            } else {
                None
            },
        }))
    }
}

impl ProviderPort for StartupRaceSnapshotProbePort {
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
        test_provider_snapshot(self.provider)
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        Vec::new()
    }

    fn disconnect(&mut self) -> Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        if let Some(sender) = self.session_new_started_sender.take() {
            sender
                .send(self.provider)
                .map_err(|error| RuntimeError::Provider(error.to_string()))?;
        }
        if let Some(receiver) = self.release_receiver.take() {
            receiver
                .recv()
                .map_err(|error| RuntimeError::Provider(error.to_string()))?;
        }
        Ok(json!({
            "sessionId": format!("snapshot-{}", self.provider.as_str()),
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
        _cancel_after: Option<std::time::Duration>,
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

impl ProviderPort for SnapshotProbePort {
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        let mut locked = self
            .calls
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("snapshot calls lock: {error}")))?;
        locked.push((self.provider, "initialize".to_owned()));
        Ok(test_initialize_result(request))
    }

    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        Ok(None)
    }

    fn snapshot(&self) -> ProviderSnapshot {
        test_provider_snapshot(self.provider)
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        Vec::new()
    }

    fn disconnect(&mut self) -> Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        let mut locked = self
            .calls
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("snapshot calls lock: {error}")))?;
        locked.push((self.provider, "session/new".to_owned()));
        Ok(json!({
            "sessionId": format!("snapshot-{}", self.provider.as_str()),
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
        _cancel_after: Option<std::time::Duration>,
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

fn test_initialize_result(request: ProviderInitializeRequest) -> ProviderInitializeResult {
    ProviderInitializeResult {
        request,
        response: ProviderInitializeResponse {
            protocol_version: ProtocolVersion::V1,
            agent_capabilities: AgentCapabilities::default(),
            agent_info: Some(Implementation::new("test-agent", "0.1.0")),
            auth_methods: Vec::new(),
        },
    }
}

fn test_provider_snapshot(provider: ProviderId) -> ProviderSnapshot {
    ProviderSnapshot {
        provider,
        connection_state: ConnectionState::Ready,
        discovery: ProviderDiscovery {
            provider,
            launcher: LauncherCommand {
                executable: PathBuf::from(provider.as_str()),
                args: Vec::new(),
                display: provider.as_str().to_owned(),
            },
            resolved_path: provider.as_str().to_owned(),
            version: "test".to_owned(),
            auth_hints: Vec::new(),
            initialize_viable: true,
            transport_diagnostics: Vec::new(),
            initialize_probe: InitializeProbe {
                response: json!({}),
                payload: InitializeResponse::new(ProtocolVersion::V1)
                    .agent_info(Implementation::new("test-agent", "0.1.0")),
                stdout_lines: Vec::new(),
                stderr_lines: Vec::new(),
                elapsed_ms: 1,
            },
        },
        capabilities: json!({}),
        auth_methods: Vec::new(),
        live_sessions: Vec::new(),
        last_prompt: None,
        loaded_transcripts: Vec::new(),
    }
}

fn wait_for_ready_snapshot(snapshots: &ProviderConfigSnapshots) -> Vec<Value> {
    let deadline = Instant::now() + Duration::from_secs(1);
    loop {
        let snapshot = snapshots.snapshot_value();
        let entries = snapshot["entries"].as_array().cloned().unwrap_or_default();
        if entries
            .iter()
            .all(|entry| entry["status"] == json!("ready"))
        {
            return entries;
        }
        assert!(
            Instant::now() < deadline,
            "provider config snapshot did not become ready: {snapshot}"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn receive_started_provider(receiver: &mpsc::Receiver<ProviderId>) -> ProviderId {
    let result = receiver.recv_timeout(Duration::from_secs(1));
    assert!(
        result.is_ok(),
        "initial session/new probe should start: {result:?}"
    );
    result.unwrap_or(ProviderId::Claude)
}

fn release_initial_probe(sender: mpsc::Sender<()>) {
    assert!(
        sender.send(()).is_ok(),
        "initial session/new probe release should send"
    );
}

fn assert_loading_snapshot(snapshots: &ProviderConfigSnapshots) {
    let snapshot = snapshots.snapshot_value();
    let entries = snapshot["entries"].as_array();
    assert!(entries.is_some(), "snapshot entries array");
    let entries = entries.cloned().unwrap_or_default();
    assert_eq!(entries.len(), 3);
    for (entry, provider) in entries.into_iter().zip(["claude", "copilot", "codex"]) {
        assert_eq!(entry["provider"], json!(provider));
        assert_eq!(entry["status"], json!("loading"));
        assert_eq!(entry["configOptions"], Value::Null);
        assert_eq!(entry["modes"], Value::Null);
        assert_eq!(entry["models"], Value::Null);
        assert_eq!(entry["fetchedAt"], Value::Null);
        assert_eq!(entry["error"], Value::Null);
    }
}

fn assert_ready_snapshot(entries: Vec<Value>) {
    for (entry, provider) in entries.into_iter().zip(["claude", "copilot", "codex"]) {
        assert_eq!(entry["provider"], json!(provider));
        assert_eq!(entry["status"], json!("ready"));
        assert_eq!(entry["configOptions"], json!([]));
        assert!(entry["fetchedAt"].as_str().is_some());
        assert_eq!(entry["error"], Value::Null);
    }
}
