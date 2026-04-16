//! Background refresh for project cwd suggestions.

use super::{StoreLock, StoreOpener};
use service_runtime::{ProviderFactory, RuntimeEvent, ServiceRuntime};
use std::thread;
use std::time::Duration;
use tokio::sync::broadcast;

const SUGGESTION_REFRESH_INTERVAL: Duration = Duration::from_secs(30 * 60);

pub(super) fn spawn_suggestion_refresh_worker<F>(
    factory: F,
    events: broadcast::Sender<RuntimeEvent>,
    refresh_store: StoreOpener,
    store_lock: StoreLock,
) where
    F: ProviderFactory + 'static,
{
    let _worker = thread::spawn(move || {
        run_suggestion_refresh_worker(factory, events, refresh_store, store_lock);
    });
}

fn run_suggestion_refresh_worker<F>(
    factory: F,
    events: broadcast::Sender<RuntimeEvent>,
    refresh_store: StoreOpener,
    store_lock: StoreLock,
) where
    F: ProviderFactory,
{
    let Ok(local_store) = refresh_store() else {
        tracing::error!(
            event_name = "suggestion_refresh.store_unavailable",
            source = "service-bin"
        );
        return;
    };
    let mut runtime = ServiceRuntime::with_factory_and_store_lock(factory, local_store, store_lock);
    let live_events = events.clone();
    runtime.set_event_sink(Box::new(move |event| {
        let _subscriber_count = live_events.send(event);
    }));
    tracing::info!(
        event_name = "suggestion_refresh.started",
        source = "service-bin"
    );
    refresh_suggestions(&mut runtime);
    loop {
        thread::sleep(SUGGESTION_REFRESH_INTERVAL);
        refresh_suggestions(&mut runtime);
    }
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Refresh outcome is intentionally logged with branch-specific severity."
)]
fn refresh_suggestions<F>(runtime: &mut ServiceRuntime<F>)
where
    F: ProviderFactory,
{
    let refresh_status = runtime.refresh_project_suggestions();
    if let Err(error) = refresh_status {
        tracing::warn!(
            event_name = "suggestion_refresh.failed",
            source = "service-bin",
            error_message = %error
        );
    } else {
        tracing::debug!(event_name = "suggestion_refresh.ok", source = "service-bin");
    }
}
