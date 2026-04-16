use super::{StoreLock, StoreOpener};
use serde_json::json;
use service_runtime::contracts::SessionGroupsView;
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

#[allow(
    clippy::cognitive_complexity,
    reason = "Startup hydration orchestrates store bootstrap, index refresh, target discovery, and batched hydration."
)]
async fn run_startup_hydration<F>(factory: F, store: StoreOpener, store_lock: StoreLock)
where
    F: ProviderFactory,
{
    let Ok(local_store) = store() else {
        tracing::error!(
            event_name = "startup_hydration.store_unavailable",
            source = "service-bin"
        );
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    tracing::info!(
        event_name = "startup_hydration.started",
        source = "service-bin"
    );
    if let Err(error) = runtime.force_refresh_session_index("all") {
        tracing::warn!(
            event_name = "startup_hydration.refresh_failed",
            source = "service-bin",
            error_message = %error
        );
    }
    let targets = startup_hydration_targets(&mut runtime);
    tracing::info!(
        event_name = "startup_hydration.targets",
        source = "service-bin",
        target_count = targets.len()
    );
    hydrate_targets(&mut runtime, &targets).await;
    tracing::info!(
        event_name = "startup_hydration.finished",
        source = "service-bin"
    );
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

#[allow(
    clippy::cognitive_complexity,
    reason = "Hydration loop logs success/failure details and applies cooperative scheduling throttles."
)]
async fn hydrate_targets<F>(runtime: &mut ServiceRuntime<F>, targets: &[HydrationTarget])
where
    F: ProviderFactory,
{
    for (index, target) in targets.iter().enumerate() {
        let response = runtime.dispatch(ConsumerCommand {
            id: format!("startup-hydration-open-{index}"),
            command: "session/open".to_owned(),
            provider: target.provider.clone(),
            params: json!({
                "sessionId": target.session_id,
                "cwd": target.cwd,
                "limit": STARTUP_HYDRATION_LIMIT,
            }),
        });
        if response.ok {
            tracing::debug!(
                event_name = "startup_hydration.open.ok",
                source = "service-bin",
                provider = %target.provider,
                session_id = %target.session_id,
                cwd = %target.cwd,
                index
            );
        } else {
            let error_code = response
                .error
                .as_ref()
                .map(|error| error.code.as_str())
                .unwrap_or("unknown");
            let error_message = response
                .error
                .as_ref()
                .map(|error| error.message.as_str())
                .unwrap_or("missing response error");
            tracing::warn!(
                event_name = "startup_hydration.open.failed",
                source = "service-bin",
                provider = %target.provider,
                session_id = %target.session_id,
                cwd = %target.cwd,
                index,
                error_code = %error_code,
                error_message = %error_message
            );
        }
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
                provider: session.provider.to_string(),
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
