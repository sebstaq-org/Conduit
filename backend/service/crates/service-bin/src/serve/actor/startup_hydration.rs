use super::{StoreLock, StoreOpener};
use serde::Deserialize;
use serde_json::json;
use service_runtime::{ConsumerCommand, ConsumerResponse, ProviderFactory, ServiceRuntime};
use std::collections::HashSet;
use std::time::Duration;
use tokio::task::yield_now;
use tokio::time::sleep;

const STARTUP_HYDRATION_LIMIT: u64 = 100;
const STARTUP_HYDRATION_YIELD_EVERY: usize = 8;
const STARTUP_HYDRATION_PAUSE_EVERY: usize = 32;
const STARTUP_HYDRATION_PAUSE: Duration = Duration::from_millis(5);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct HydrationTarget {
    provider: String,
    session_id: String,
    cwd: String,
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

pub(super) fn spawn_startup_hydration_worker<F>(
    factory: F,
    store: StoreOpener,
    store_lock: StoreLock,
) where
    F: ProviderFactory + 'static,
{
    tokio::spawn(async move {
        run_startup_hydration(factory, store, store_lock).await;
    });
}

async fn run_startup_hydration<F>(factory: F, store: StoreOpener, store_lock: StoreLock)
where
    F: ProviderFactory,
{
    let Ok(local_store) = store() else {
        eprintln!("[startup-hydration] skipped: failed to open local store");
        return;
    };
    eprintln!("[startup-hydration] start");
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);

    if let Err(error) = runtime.force_refresh_session_index("all") {
        eprintln!("[startup-hydration] refresh failed: {error}");
    }

    let grouped = runtime.dispatch(ConsumerCommand {
        id: "startup-hydration-grouped".to_owned(),
        command: "sessions/grouped".to_owned(),
        provider: "all".to_owned(),
        params: json!({}),
    });
    if !grouped.ok {
        eprintln!(
            "[startup-hydration] grouped query failed: {}",
            response_error_message(&grouped)
        );
        return;
    }

    let targets = hydration_targets(&grouped.result);
    eprintln!("[startup-hydration] discovered {} targets", targets.len());
    let mut hydrated = 0usize;
    let mut failed = 0usize;
    for (index, target) in targets.iter().enumerate() {
        let open_status = runtime.dispatch(ConsumerCommand {
            id: format!("startup-hydration-open-{index}"),
            command: "session/open".to_owned(),
            provider: target.provider.clone(),
            params: json!({
                "sessionId": target.session_id,
                "cwd": target.cwd,
                "limit": STARTUP_HYDRATION_LIMIT,
            }),
        });
        if open_status.ok {
            hydrated = hydrated.saturating_add(1);
        } else {
            failed = failed.saturating_add(1);
            eprintln!(
                "[startup-hydration] session/open failed provider={} sessionId={} cwd={} error={}",
                target.provider,
                target.session_id,
                target.cwd,
                response_error_message(&open_status)
            );
        }
        if (index + 1) % STARTUP_HYDRATION_YIELD_EVERY == 0 {
            yield_now().await;
        }
        if (index + 1) % STARTUP_HYDRATION_PAUSE_EVERY == 0 {
            sleep(STARTUP_HYDRATION_PAUSE).await;
        }
    }
    eprintln!(
        "[startup-hydration] complete attempted={} hydrated={} failed={}",
        targets.len(),
        hydrated,
        failed
    );
}

fn hydration_targets(result: &serde_json::Value) -> Vec<HydrationTarget> {
    let Ok(view) = serde_json::from_value::<SessionGroupsView>(result.clone()) else {
        return Vec::new();
    };
    let mut seen = HashSet::new();
    let mut targets = Vec::new();

    for group in view.groups {
        for session in group.sessions {
            let target = HydrationTarget {
                provider: session.provider,
                session_id: session.session_id,
                cwd: group.cwd.clone(),
            };
            if seen.insert(target.clone()) {
                targets.push(target);
            }
        }
    }

    targets
}

fn response_error_message(response: &ConsumerResponse) -> String {
    response
        .error
        .as_ref()
        .map(|error| format!("{}: {}", error.code, error.message))
        .unwrap_or_else(|| "unknown error".to_owned())
}
