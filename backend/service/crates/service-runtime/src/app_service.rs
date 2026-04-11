//! `app-api` backed provider runtime adapter.

use crate::{ProviderFactory, ProviderPort, Result, RuntimeError};
use acp_core::{ProviderSnapshot, RawWireEvent};
use acp_discovery::{ProcessEnvironment, ProviderId};
use app_api::AppService;
use serde::Serialize;
use serde_json::{Value, json, to_value};
use std::path::PathBuf;

/// Factory that connects real `app-api` provider services.
#[derive(Debug, Clone, Default)]
pub struct AppServiceFactory {
    environment: ProcessEnvironment,
}

impl AppServiceFactory {
    /// Creates a factory with explicit provider process environment overrides.
    #[must_use]
    pub fn with_environment(environment: ProcessEnvironment) -> Self {
        Self { environment }
    }
}

impl ProviderFactory for AppServiceFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(AppServicePort {
            service: AppService::connect_provider_with_environment(provider, &self.environment)
                .map_err(|error| RuntimeError::Provider(error.to_string()))?,
        }))
    }
}

struct AppServicePort {
    service: AppService,
}

impl ProviderPort for AppServicePort {
    fn snapshot(&self) -> ProviderSnapshot {
        self.service.get_provider_snapshot()
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        self.service.operation_snapshot().raw_events
    }

    fn disconnect(&mut self) -> Result<()> {
        self.service.disconnect_provider();
        Ok(())
    }

    fn session_new(&mut self, cwd: PathBuf) -> Result<Value> {
        serialize(self.service.new_session(cwd))
    }

    fn session_list(&mut self) -> Result<Value> {
        serialize(self.service.list_sessions())
    }

    fn session_load(&mut self, session_id: String, cwd: PathBuf) -> Result<Value> {
        serialize(self.service.load_session(session_id, cwd))
    }

    fn session_prompt(&mut self, session_id: String, prompt: String) -> Result<Value> {
        serialize(self.service.prompt_text(&session_id, &prompt))
    }

    fn session_cancel(&mut self, session_id: String) -> Result<Value> {
        self.service
            .cancel_prompt(&session_id)
            .map_err(|error| RuntimeError::Provider(error.to_string()))?;
        Ok(json!({}))
    }
}

fn serialize<T>(result: acp_core::Result<T>) -> Result<Value>
where
    T: Serialize,
{
    let value = result.map_err(|error| RuntimeError::Provider(error.to_string()))?;
    to_value(value).map_err(|error| RuntimeError::Provider(error.to_string()))
}
