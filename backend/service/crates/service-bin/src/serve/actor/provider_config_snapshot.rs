//! Background provider config-option snapshot for draft composer usage.

use acp_discovery::ProviderId;
use serde::Serialize;
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, ProviderInitializeRequest, ProviderPort};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const PROVIDER_CONFIG_SNAPSHOT_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Clone)]
pub(super) struct ProviderConfigSnapshots {
    entries: Arc<RwLock<Vec<ProviderConfigSnapshotEntry>>>,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum ProviderConfigSnapshotStatus {
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

    pub(super) fn provider_status(&self, provider: &str) -> Option<ProviderConfigSnapshotStatus> {
        self.entries.read().ok().and_then(|entries| {
            entries
                .iter()
                .find(|entry| entry.provider.as_str() == provider)
                .map(|entry| entry.status)
        })
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
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "provider_config_snapshot.refresh.start",
        source = "service-bin"
    );
    let cwd = probe_cwd();
    let entries = [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex]
        .into_iter()
        .map(|provider| probe_provider_config(factory, provider, cwd.clone()))
        .collect();
    snapshots.replace_entries(entries);
    tracing::info!(
        event_name = "provider_config_snapshot.refresh.finish",
        source = "service-bin",
        duration_ms = started_at.elapsed().as_millis()
    );
}

fn probe_provider_config<F>(
    factory: &mut F,
    provider: ProviderId,
    cwd: PathBuf,
) -> ProviderConfigSnapshotEntry
where
    F: ProviderFactory,
{
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "provider_config_snapshot.provider.start",
        source = "service-bin",
        provider = %provider.as_str(),
        cwd = %cwd.display()
    );
    let fetched_at = Some(unix_timestamp_seconds());
    let entry = match factory.connect(provider) {
        Ok(mut port) => probe_connected_provider_config(provider, cwd, fetched_at, &mut *port),
        Err(error) => {
            let message = error.to_string();
            failed_entry(provider, classify_status(&message), fetched_at, message)
        }
    };
    log_provider_config_probe_finish(&entry, started_at.elapsed());
    entry
}

fn probe_connected_provider_config(
    provider: ProviderId,
    cwd: PathBuf,
    fetched_at: Option<String>,
    port: &mut dyn ProviderPort,
) -> ProviderConfigSnapshotEntry {
    if let Err(error) = port.initialize(ProviderInitializeRequest::conduit_default()) {
        let _disconnect_status = port.disconnect();
        let message = error.to_string();
        return failed_entry(provider, classify_status(&message), fetched_at, message);
    }
    let result = port.session_new(cwd);
    let _disconnect_status = port.disconnect();
    match result {
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

fn log_provider_config_probe_finish(entry: &ProviderConfigSnapshotEntry, duration: Duration) {
    let config_option_count = entry.config_options.as_array().map_or(0, Vec::len);
    match entry.status {
        ProviderConfigSnapshotStatus::Ready => {
            log_ready_provider_config_probe(entry, duration, config_option_count)
        }
        ProviderConfigSnapshotStatus::Loading
        | ProviderConfigSnapshotStatus::Error
        | ProviderConfigSnapshotStatus::Unavailable => {
            log_failed_provider_config_probe(entry, duration, config_option_count)
        }
    }
}

fn log_ready_provider_config_probe(
    entry: &ProviderConfigSnapshotEntry,
    duration: Duration,
    config_option_count: usize,
) {
    tracing::info!(
        event_name = "provider_config_snapshot.provider.finish",
        source = "service-bin",
        provider = %entry.provider.as_str(),
        status = ?entry.status,
        duration_ms = duration.as_millis(),
        config_option_count
    );
}

fn log_failed_provider_config_probe(
    entry: &ProviderConfigSnapshotEntry,
    duration: Duration,
    config_option_count: usize,
) {
    tracing::warn!(
        event_name = "provider_config_snapshot.provider.finish",
        source = "service-bin",
        provider = %entry.provider.as_str(),
        status = ?entry.status,
        duration_ms = duration.as_millis(),
        config_option_count,
        error_message = entry.error.as_deref().unwrap_or("missing error")
    );
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
