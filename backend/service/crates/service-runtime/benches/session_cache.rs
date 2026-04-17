//! Benchmark suite for session-open cache behavior and startup hydration cost.

use acp_core::{
    ConnectionState, LiveSessionIdentity, LoadedTranscriptSnapshot, ProviderSnapshot, RawWireEvent,
    TranscriptUpdateSnapshot, WireKind, WireStream,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use app_api as _;
use criterion::{BatchSize, BenchmarkId, Criterion, Throughput, black_box};
use schemars as _;
use serde::Deserialize;
use serde_json::{Value, json};
use service_runtime::{
    ConsumerCommand, ProviderFactory, ProviderPort, RuntimeError, ServiceRuntime,
};
use session_store::LocalStore;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror as _;
use tracing as _;
use tracing_subscriber as _;

static NEXT_BENCH_DB: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy)]
struct BenchDataset {
    label: &'static str,
    session_count: usize,
    items_per_session: usize,
}

const DATASETS: [BenchDataset; 3] = [
    BenchDataset {
        label: "small",
        session_count: 12,
        items_per_session: 24,
    },
    BenchDataset {
        label: "medium",
        session_count: 48,
        items_per_session: 60,
    },
    BenchDataset {
        label: "large",
        session_count: 120,
        items_per_session: 100,
    },
];

#[derive(Clone)]
struct FakeFactory {
    state: Arc<Mutex<FakeState>>,
}

#[derive(Default)]
struct FakeState {
    session_load_calls: usize,
    session_list_rows: Vec<SessionListRow>,
    loaded_transcripts: HashMap<String, LoadedTranscriptSnapshot>,
    updates_by_session: HashMap<String, Vec<TranscriptUpdateSnapshot>>,
}

#[derive(Clone)]
struct SessionListRow {
    session_id: String,
    cwd: String,
    title: Option<String>,
    updated_at: String,
}

#[derive(Debug, Clone, Default)]
struct CaseMetrics {
    payload_bytes: u64,
    store_bytes: u64,
    hydrated_items: u64,
    provider_load_calls: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionGroupsView {
    groups: Vec<SessionGroup>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionGroup {
    cwd: String,
    sessions: Vec<SessionRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionRow {
    provider: String,
    session_id: String,
}

impl ProviderFactory for FakeFactory {
    fn connect(&mut self, provider: ProviderId) -> service_runtime::Result<Box<dyn ProviderPort>> {
        Ok(Box::new(FakeProvider {
            provider,
            state: Arc::clone(&self.state),
        }))
    }
}

struct FakeProvider {
    provider: ProviderId,
    state: Arc<Mutex<FakeState>>,
}

impl ProviderPort for FakeProvider {
    fn snapshot(&self) -> ProviderSnapshot {
        let loaded_transcripts = self
            .state
            .lock()
            .map(|state| {
                state
                    .loaded_transcripts
                    .values()
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        ProviderSnapshot {
            provider: self.provider,
            connection_state: ConnectionState::Ready,
            discovery: fake_discovery(self.provider),
            capabilities: json!({}),
            auth_methods: Vec::new(),
            live_sessions: Vec::new(),
            last_prompt: None,
            loaded_transcripts,
        }
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        vec![RawWireEvent {
            sequence: 1,
            stream: WireStream::Outgoing,
            kind: WireKind::Request,
            payload: "{}".to_owned(),
            method: Some("session/open".to_owned()),
            request_id: Some("1".to_owned()),
            json: Some(json!({})),
        }]
    }

    fn disconnect(&mut self) -> service_runtime::Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> service_runtime::Result<Value> {
        Ok(json!({ "sessionId": "session-new" }))
    }

    fn session_list(
        &mut self,
        cwd: Option<PathBuf>,
        _cursor: Option<String>,
    ) -> service_runtime::Result<Value> {
        let cwd = cwd.map(|value| value.display().to_string());
        let rows = {
            let state = self
                .state
                .lock()
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
            state
                .session_list_rows
                .iter()
                .filter(|row| cwd.as_ref().is_none_or(|value| row.cwd == *value))
                .map(|row| {
                    json!({
                        "sessionId": row.session_id,
                        "cwd": row.cwd,
                        "title": row.title,
                        "updatedAt": row.updated_at,
                    })
                })
                .collect::<Vec<_>>()
        };
        Ok(json!({
            "sessions": rows,
            "nextCursor": Value::Null,
        }))
    }

    fn session_load(
        &mut self,
        session_id: String,
        _cwd: PathBuf,
    ) -> service_runtime::Result<Value> {
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        state.session_load_calls = state.session_load_calls.saturating_add(1);
        let updates = state
            .updates_by_session
            .get(&session_id)
            .cloned()
            .unwrap_or_default();
        state.loaded_transcripts.insert(
            session_id.clone(),
            LoadedTranscriptSnapshot {
                identity: LiveSessionIdentity {
                    provider: self.provider,
                    acp_session_id: session_id.clone(),
                },
                raw_update_count: updates.len(),
                updates,
            },
        );
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        _prompt: Vec<Value>,
        _update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> service_runtime::Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "stopReason": "end_turn",
        }))
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        _config_id: String,
        _value: String,
    ) -> service_runtime::Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "configOptions": [],
        }))
    }

    fn session_cancel(&mut self, session_id: String) -> service_runtime::Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }
}

fn benchmark_session_cache(c: &mut Criterion) {
    for dataset in DATASETS {
        benchmark_open_cold(c, dataset);
        benchmark_open_warm_after_restart(c, dataset);
        benchmark_startup_hydration(c, dataset);
    }
}

fn benchmark_open_cold(c: &mut Criterion, dataset: BenchDataset) {
    let baseline = run_open_cold(dataset);
    let Some(metrics) = baseline else {
        return;
    };
    let mut group = c.benchmark_group("session_open_cold");
    group.throughput(Throughput::Bytes(metrics.payload_bytes));
    group.bench_function(
        BenchmarkId::new(
            dataset.label,
            format!(
                "items{}-loads{}-store{}",
                metrics.hydrated_items, metrics.provider_load_calls, metrics.store_bytes
            ),
        ),
        |b| {
            b.iter_batched(
                || dataset,
                |input| {
                    if let Some(run) = run_open_cold(input) {
                        black_box(run);
                        return;
                    }
                    std::process::abort();
                },
                BatchSize::SmallInput,
            );
        },
    );
    group.finish();
}

fn benchmark_open_warm_after_restart(c: &mut Criterion, dataset: BenchDataset) {
    let baseline = run_open_warm_after_restart(dataset);
    let Some(metrics) = baseline else {
        return;
    };
    let mut group = c.benchmark_group("session_open_warm_after_restart");
    group.throughput(Throughput::Bytes(metrics.payload_bytes));
    group.bench_function(
        BenchmarkId::new(
            dataset.label,
            format!(
                "items{}-loads{}-store{}",
                metrics.hydrated_items, metrics.provider_load_calls, metrics.store_bytes
            ),
        ),
        |b| {
            b.iter_batched(
                || dataset,
                |input| {
                    if let Some(run) = run_open_warm_after_restart(input) {
                        black_box(run);
                        return;
                    }
                    std::process::abort();
                },
                BatchSize::SmallInput,
            );
        },
    );
    group.finish();
}

fn benchmark_startup_hydration(c: &mut Criterion, dataset: BenchDataset) {
    let baseline = run_startup_hydration(dataset);
    let Some(metrics) = baseline else {
        return;
    };
    let mut group = c.benchmark_group("startup_hydration");
    group.throughput(Throughput::Bytes(metrics.store_bytes));
    group.bench_function(
        BenchmarkId::new(
            dataset.label,
            format!(
                "items{}-loads{}-payload{}",
                metrics.hydrated_items, metrics.provider_load_calls, metrics.payload_bytes
            ),
        ),
        |b| {
            b.iter_batched(
                || dataset,
                |input| {
                    if let Some(run) = run_startup_hydration(input) {
                        black_box(run);
                        return;
                    }
                    std::process::abort();
                },
                BatchSize::SmallInput,
            );
        },
    );
    group.finish();
}

fn run_open_cold(dataset: BenchDataset) -> Option<CaseMetrics> {
    let path = bench_db_path("open-cold")?;
    let mut runtime_and_state = runtime_for_dataset(dataset, &path)?;
    let response = runtime_and_state.runtime.dispatch(open_command(
        "cold-open",
        ProviderId::Codex.as_str(),
        "session-1",
        "/repo",
        100,
    ));
    if !response.ok {
        remove_db(&path);
        return None;
    }

    let mut metrics = CaseMetrics::default();
    accumulate_response_metrics(&response.result, &mut metrics);
    metrics.store_bytes = sqlite_store_footprint_bytes(&path);
    metrics.provider_load_calls = runtime_and_state
        .state
        .lock()
        .map(|state| state.session_load_calls as u64)
        .unwrap_or(0);
    remove_db(&path);
    Some(metrics)
}

fn run_open_warm_after_restart(dataset: BenchDataset) -> Option<CaseMetrics> {
    let path = bench_db_path("open-warm")?;
    {
        let mut priming = runtime_for_dataset(dataset, &path)?;
        let response = priming.runtime.dispatch(open_command(
            "warm-prime",
            ProviderId::Codex.as_str(),
            "session-1",
            "/repo",
            100,
        ));
        if !response.ok {
            remove_db(&path);
            return None;
        }
    }

    let mut restarted = runtime_for_dataset(dataset, &path)?;
    let response = restarted.runtime.dispatch(open_command(
        "warm-open",
        ProviderId::Codex.as_str(),
        "session-1",
        "/repo",
        100,
    ));
    if !response.ok {
        remove_db(&path);
        return None;
    }

    let mut metrics = CaseMetrics::default();
    accumulate_response_metrics(&response.result, &mut metrics);
    metrics.store_bytes = sqlite_store_footprint_bytes(&path);
    metrics.provider_load_calls = restarted
        .state
        .lock()
        .map(|state| state.session_load_calls as u64)
        .unwrap_or(0);
    remove_db(&path);
    Some(metrics)
}

fn run_startup_hydration(dataset: BenchDataset) -> Option<CaseMetrics> {
    let path = bench_db_path("startup-hydration")?;
    let mut runtime_and_state = runtime_for_dataset(dataset, &path)?;

    let initial_store_size = sqlite_store_footprint_bytes(&path);
    if runtime_and_state
        .runtime
        .force_refresh_session_index("all")
        .is_err()
    {
        remove_db(&path);
        return None;
    }

    let grouped = runtime_and_state.runtime.dispatch(ConsumerCommand {
        id: "hydrate-grouped".to_owned(),
        command: "sessions/grouped".to_owned(),
        provider: "all".to_owned(),
        params: json!({}),
    });
    if !grouped.ok {
        remove_db(&path);
        return None;
    }

    let targets = grouped_targets(&grouped.result);
    let mut metrics = CaseMetrics::default();
    for (index, target) in targets.iter().enumerate() {
        let response = runtime_and_state.runtime.dispatch(open_command(
            &format!("hydrate-open-{index}"),
            &target.provider,
            &target.session_id,
            &target.cwd,
            100,
        ));
        if !response.ok {
            remove_db(&path);
            return None;
        }
        accumulate_response_metrics(&response.result, &mut metrics);
    }

    let final_store_size = sqlite_store_footprint_bytes(&path);
    metrics.store_bytes = final_store_size.saturating_sub(initial_store_size);
    metrics.provider_load_calls = runtime_and_state
        .state
        .lock()
        .map(|state| state.session_load_calls as u64)
        .unwrap_or(0);

    remove_db(&path);
    Some(metrics)
}

fn runtime_for_dataset(dataset: BenchDataset, path: &Path) -> Option<RuntimeAndState> {
    let mut store = LocalStore::open_path(path).ok()?;
    store.add_project("/repo").ok()?;

    let state = Arc::new(Mutex::new(fake_state_for_dataset(dataset)));
    let factory = FakeFactory {
        state: Arc::clone(&state),
    };
    let runtime = ServiceRuntime::with_factory(factory, store);
    Some(RuntimeAndState { runtime, state })
}

fn fake_state_for_dataset(dataset: BenchDataset) -> FakeState {
    let mut updates_by_session = HashMap::new();
    let mut session_list_rows = Vec::new();
    for index in 0..dataset.session_count {
        let session_id = format!("session-{}", index + 1);
        updates_by_session.insert(
            session_id.clone(),
            fake_updates_for_session(dataset.items_per_session),
        );
        session_list_rows.push(SessionListRow {
            session_id,
            cwd: "/repo".to_owned(),
            title: Some(format!("Session {}", index + 1)),
            updated_at: format!("2026-04-15T{:02}:00:00.000Z", index % 24),
        });
    }
    FakeState {
        session_load_calls: 0,
        session_list_rows,
        loaded_transcripts: HashMap::new(),
        updates_by_session,
    }
}

fn fake_updates_for_session(item_count: usize) -> Vec<TranscriptUpdateSnapshot> {
    let mut updates = Vec::new();
    for index in 0..item_count {
        let (variant, role) = if index % 2 == 0 {
            ("user_message_chunk", "user")
        } else {
            ("agent_message_chunk", "agent")
        };
        updates.push(TranscriptUpdateSnapshot {
            index,
            variant: variant.to_owned(),
            update: json!({
                "sessionUpdate": variant,
                "role": role,
                "content": {
                    "type": "text",
                    "text": format!("{role}-{index}"),
                }
            }),
        });
    }
    updates
}

fn open_command(
    id: &str,
    provider: &str,
    session_id: &str,
    cwd: &str,
    limit: u64,
) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: "session/open".to_owned(),
        provider: provider.to_owned(),
        params: json!({
            "sessionId": session_id,
            "cwd": cwd,
            "limit": limit,
        }),
    }
}

fn accumulate_response_metrics(result: &Value, metrics: &mut CaseMetrics) {
    let payload = serde_json::to_vec(result).map_or(0, |bytes| bytes.len() as u64);
    metrics.payload_bytes = metrics.payload_bytes.saturating_add(payload);
    let item_count = result
        .get("items")
        .and_then(Value::as_array)
        .map_or(0, |items| items.len() as u64);
    metrics.hydrated_items = metrics.hydrated_items.saturating_add(item_count);
}

fn grouped_targets(result: &Value) -> Vec<HydrationTarget> {
    let Ok(view) = serde_json::from_value::<SessionGroupsView>(result.clone()) else {
        return Vec::new();
    };
    let mut targets = Vec::new();
    for group in view.groups {
        for session in group.sessions {
            targets.push(HydrationTarget {
                provider: session.provider,
                session_id: session.session_id,
                cwd: group.cwd.clone(),
            });
        }
    }
    targets
}

fn bench_db_path(label: &str) -> Option<PathBuf> {
    let sequence = NEXT_BENCH_DB.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    Some(std::env::temp_dir().join(format!(
        "conduit-runtime-bench-{label}-{sequence}-{nanos}.sqlite3"
    )))
}

fn sqlite_store_footprint_bytes(path: &Path) -> u64 {
    sqlite_store_paths(path)
        .into_iter()
        .map(|store_path| {
            fs::metadata(store_path)
                .ok()
                .map_or(0, |metadata| metadata.len())
        })
        .sum()
}

fn remove_db(path: &Path) {
    for store_path in sqlite_store_paths(path) {
        let _remove_status = fs::remove_file(store_path);
    }
}

fn sqlite_store_paths(path: &Path) -> [PathBuf; 3] {
    let base = path.to_string_lossy();
    [
        path.to_path_buf(),
        PathBuf::from(format!("{base}-wal")),
        PathBuf::from(format!("{base}-shm")),
    ]
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
                .agent_info(Implementation::new("bench-agent", "0.5.0")),
            stdout_lines: Vec::new(),
            stderr_lines: Vec::new(),
            elapsed_ms: 1,
        },
    }
}

struct RuntimeAndState {
    runtime: ServiceRuntime<FakeFactory>,
    state: Arc<Mutex<FakeState>>,
}

#[derive(Debug)]
struct HydrationTarget {
    provider: String,
    session_id: String,
    cwd: String,
}

fn main() {
    let mut criterion = Criterion::default().configure_from_args();
    benchmark_session_cache(&mut criterion);
    criterion.final_summary();
}
