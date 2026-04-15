use super::{StoreLock, StoreOpener};
use serde::Deserialize;
use serde_json::json;
use service_runtime::{ConsumerCommand, ProviderFactory, ServiceRuntime};
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
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let _ = runtime.force_refresh_session_index("all");
    let targets = startup_hydration_targets(&mut runtime);
    hydrate_targets(&mut runtime, &targets).await;
}

fn startup_hydration_targets<F>(runtime: &mut ServiceRuntime<F>) -> Vec<HydrationTarget>
where
    F: ProviderFactory,
{
    let grouped = runtime.dispatch(ConsumerCommand {
        id: "startup-hydration-grouped".to_owned(),
        command: "sessions/grouped".to_owned(),
        provider: "all".to_owned(),
        params: json!({}),
    });
    if grouped.ok {
        return hydration_targets(&grouped.result);
    }
    Vec::new()
}

async fn hydrate_targets<F>(runtime: &mut ServiceRuntime<F>, targets: &[HydrationTarget])
where
    F: ProviderFactory,
{
    for (index, target) in targets.iter().enumerate() {
        let _ = runtime.dispatch(ConsumerCommand {
            id: format!("startup-hydration-open-{index}"),
            command: "session/open".to_owned(),
            provider: target.provider.clone(),
            params: json!({
                "sessionId": target.session_id,
                "cwd": target.cwd,
                "limit": STARTUP_HYDRATION_LIMIT,
            }),
        });
        if (index + 1) % STARTUP_HYDRATION_YIELD_EVERY == 0 {
            yield_now().await;
        }
        if (index + 1) % STARTUP_HYDRATION_PAUSE_EVERY == 0 {
            sleep(STARTUP_HYDRATION_PAUSE).await;
        }
    }
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
