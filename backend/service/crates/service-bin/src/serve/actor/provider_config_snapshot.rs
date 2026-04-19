//! Background provider config-option snapshot for draft composer usage.

use acp_discovery::ProviderId;
use serde::Serialize;
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, ProviderInitializeRequest};
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

    if let Err(error) = port.initialize(ProviderInitializeRequest::conduit_default()) {
        let _disconnect_status = port.disconnect();
        let message = error.to_string();
        return failed_entry(provider, classify_status(&message), fetched_at, message);
    }
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
#[path = "provider_config_snapshot_tests.rs"]
mod provider_config_snapshot_tests;
