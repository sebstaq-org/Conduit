//! Background provider config-option snapshot for draft composer usage.

use acp_discovery::ProviderId;
use serde::Serialize;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const PROVIDER_CONFIG_SNAPSHOT_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Clone)]
pub(super) struct ProviderConfigSnapshots {
    entries: Arc<RwLock<Vec<ProviderConfigSnapshotEntry>>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum ProviderConfigSnapshotStatus {
    Loading,
    Ready,
    Error,
    Unavailable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderConfigSnapshotEntry {
    provider: ProviderId,
    status: ProviderConfigSnapshotStatus,
    config_options: Value,
    modes: Value,
    models: Value,
    fetched_at: Option<String>,
    error: Option<String>,
}

impl ProviderConfigSnapshots {
    fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(
                [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex]
                    .into_iter()
                    .map(loading_entry)
                    .collect(),
            )),
        }
    }

    pub(super) fn snapshot_value(&self) -> Value {
        let entries = self
            .entries
            .read()
            .ok()
            .map_or_else(Vec::new, |guard| guard.clone());
        json!({ "entries": entries })
    }

    fn replace_entries(&self, entries: Vec<ProviderConfigSnapshotEntry>) {
        if let Ok(mut guard) = self.entries.write() {
            *guard = entries;
        }
    }
}

pub(super) fn spawn_provider_config_snapshot_worker<F>(factory: F) -> ProviderConfigSnapshots
where
    F: ProviderFactory + 'static,
{
    let snapshots = ProviderConfigSnapshots::new();
    let worker_state = snapshots.clone();
    let _worker = thread::spawn(move || {
        run_provider_config_snapshot_worker(factory, worker_state);
    });
    snapshots
}

fn run_provider_config_snapshot_worker<F>(mut factory: F, snapshots: ProviderConfigSnapshots)
where
    F: ProviderFactory,
{
    run_provider_config_snapshot_worker_with_wait(
        &mut factory,
        &snapshots,
        PROVIDER_CONFIG_SNAPSHOT_INTERVAL,
        |interval| {
            thread::sleep(interval);
            true
        },
    );
}

fn run_provider_config_snapshot_worker_with_wait<F, W>(
    factory: &mut F,
    snapshots: &ProviderConfigSnapshots,
    interval: Duration,
    mut wait_next: W,
) where
    F: ProviderFactory,
    W: FnMut(Duration) -> bool,
{
    refresh_provider_config_snapshot(factory, snapshots);
    while wait_next(interval) {
        refresh_provider_config_snapshot(factory, snapshots);
    }
}

fn refresh_provider_config_snapshot<F>(factory: &mut F, snapshots: &ProviderConfigSnapshots)
where
    F: ProviderFactory,
{
    let cwd = probe_cwd();
    let entries = [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex]
        .into_iter()
        .map(|provider| probe_provider_config(factory, provider, cwd.clone()))
        .collect();
    snapshots.replace_entries(entries);
}

fn probe_provider_config<F>(
    factory: &mut F,
    provider: ProviderId,
    cwd: PathBuf,
) -> ProviderConfigSnapshotEntry
where
    F: ProviderFactory,
{
    let fetched_at = Some(unix_timestamp_seconds());
    let provider_port = factory.connect(provider);
    let mut port = match provider_port {
        Ok(port) => port,
        Err(error) => {
            let message = error.to_string();
            return failed_entry(provider, classify_status(&message), fetched_at, message);
        }
    };

    let probe_result = port.session_new(cwd);
    let _disconnect_status = port.disconnect();
    match probe_result {
        Ok(result) => ProviderConfigSnapshotEntry {
            provider,
            status: ProviderConfigSnapshotStatus::Ready,
            config_options: result.get("configOptions").cloned().unwrap_or(Value::Null),
            modes: result.get("modes").cloned().unwrap_or(Value::Null),
            models: result.get("models").cloned().unwrap_or(Value::Null),
            fetched_at,
            error: None,
        },
        Err(error) => {
            let message = error.to_string();
            failed_entry(provider, classify_status(&message), fetched_at, message)
        }
    }
}

fn loading_entry(provider: ProviderId) -> ProviderConfigSnapshotEntry {
    ProviderConfigSnapshotEntry {
        provider,
        status: ProviderConfigSnapshotStatus::Loading,
        config_options: Value::Null,
        modes: Value::Null,
        models: Value::Null,
        fetched_at: None,
        error: None,
    }
}

fn failed_entry(
    provider: ProviderId,
    status: ProviderConfigSnapshotStatus,
    fetched_at: Option<String>,
    error: String,
) -> ProviderConfigSnapshotEntry {
    ProviderConfigSnapshotEntry {
        provider,
        status,
        config_options: Value::Null,
        modes: Value::Null,
        models: Value::Null,
        fetched_at,
        error: Some(error),
    }
}

fn classify_status(message: &str) -> ProviderConfigSnapshotStatus {
    let normalized = message.to_ascii_lowercase();
    if normalized.contains("not found")
        || normalized.contains("no such file")
        || normalized.contains("cannot find")
        || normalized.contains("failed to resolve")
    {
        return ProviderConfigSnapshotStatus::Unavailable;
    }
    ProviderConfigSnapshotStatus::Error
}

fn probe_cwd() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"))
}

fn unix_timestamp_seconds() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => String::from("0"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        PROVIDER_CONFIG_SNAPSHOT_INTERVAL, ProviderConfigSnapshots,
        run_provider_config_snapshot_worker_with_wait,
    };
    use acp_core::{ConnectionState, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot};
    use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
    use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
    use serde_json::{Value, json};
    use service_runtime::{ProviderFactory, ProviderPort, Result, RuntimeError};
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

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
        assert_eq!(probed.len(), 6);
        assert_eq!(
            probed,
            vec![
                ProviderId::Claude,
                ProviderId::Copilot,
                ProviderId::Codex,
                ProviderId::Claude,
                ProviderId::Copilot,
                ProviderId::Codex,
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

    #[derive(Clone)]
    struct SnapshotProbeFactory {
        calls: Arc<Mutex<Vec<ProviderId>>>,
    }

    struct SnapshotProbePort {
        provider: ProviderId,
        calls: Arc<Mutex<Vec<ProviderId>>>,
    }

    impl ProviderFactory for SnapshotProbeFactory {
        fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
            Ok(Box::new(SnapshotProbePort {
                provider,
                calls: Arc::clone(&self.calls),
            }))
        }
    }

    impl ProviderPort for SnapshotProbePort {
        fn snapshot(&self) -> ProviderSnapshot {
            ProviderSnapshot {
                provider: self.provider,
                connection_state: ConnectionState::Ready,
                discovery: ProviderDiscovery {
                    provider: self.provider,
                    launcher: LauncherCommand {
                        executable: PathBuf::from(self.provider.as_str()),
                        args: Vec::new(),
                        display: self.provider.as_str().to_owned(),
                    },
                    resolved_path: self.provider.as_str().to_owned(),
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
            locked.push(self.provider);
            Ok(json!({
                "sessionId": format!("snapshot-{}", self.provider.as_str()),
                "configOptions": []
            }))
        }

        fn session_list(
            &mut self,
            _cwd: Option<PathBuf>,
            _cursor: Option<String>,
        ) -> Result<Value> {
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
}
