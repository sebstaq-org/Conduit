//! Tracing subscriber setup for the product service binary.

use std::env;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{EnvFilter, fmt};

const LOG_PROFILE_ENV: &str = "CONDUIT_LOG_PROFILE";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LogProfile {
    Dev,
    Stage,
    Prod,
}

impl LogProfile {
    fn detect() -> Self {
        match env::var(LOG_PROFILE_ENV)
            .ok()
            .map(|raw| raw.trim().to_ascii_lowercase())
            .as_deref()
        {
            Some("dev") => Self::Dev,
            Some("stage") => Self::Stage,
            Some("prod") => Self::Prod,
            Some(_) | None if cfg!(debug_assertions) => Self::Dev,
            Some(_) | None => Self::Prod,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Dev => "dev",
            Self::Stage => "stage",
            Self::Prod => "prod",
        }
    }

    fn default_level(self) -> &'static str {
        match self {
            Self::Dev | Self::Stage => "debug",
            Self::Prod => "info",
        }
    }
}

pub(crate) fn init() {
    let profile = LogProfile::detect();
    let default_level = profile.default_level();
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_error| EnvFilter::new(default_level));
    if fmt()
        .json()
        .with_env_filter(filter)
        .with_span_events(FmtSpan::CLOSE)
        .with_current_span(true)
        .with_target(true)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_ansi(false)
        .try_init()
        .is_ok()
    {
        tracing::info!(
            event_name = "telemetry.initialized",
            source = "service-bin",
            log_profile = profile.as_str(),
            default_level
        );
    }
}
