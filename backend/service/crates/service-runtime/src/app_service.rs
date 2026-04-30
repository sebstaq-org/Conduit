//! `app-api` backed provider runtime adapter.

use crate::{ProviderFactory, ProviderPort, Result, RuntimeError};
use acp_core::{
    InteractionResponse, ProviderInitializeRequest, ProviderInitializeResult, ProviderSnapshot,
    RawWireEvent, TranscriptUpdateSnapshot,
};
use acp_discovery::{ProcessEnvironment, ProviderId};
use app_api::AppService;
use serde::Serialize;
use serde_json::{Value, json, to_value};
use std::path::PathBuf;
use std::time::Duration;

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
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        self.service
            .initialize_provider(request)
            .map_err(|error| RuntimeError::Provider(error.to_string()))
    }

    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        self.service
            .provider_initialize_result()
            .map_err(|error| RuntimeError::Provider(error.to_string()))
    }

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

    fn session_list(&mut self, cwd: Option<PathBuf>, cursor: Option<String>) -> Result<Value> {
        serialize(self.service.list_sessions_filtered(cwd, cursor))
    }

    fn session_load(&mut self, session_id: String, cwd: PathBuf) -> Result<Value> {
        serialize(self.service.load_session(session_id, cwd))
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        prompt: Vec<Value>,
        cancel_after: Option<Duration>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<Value> {
        let result = match cancel_after {
            Some(cancel_after) => self.service.prompt_content_blocks_with_cancel(
                &session_id,
                prompt,
                cancel_after,
                update_sink,
            ),
            None => self
                .service
                .prompt_content_blocks(&session_id, prompt, update_sink),
        };
        serialize(result)
    }

    fn session_cancel(&mut self, session_id: String) -> Result<Value> {
        self.service
            .cancel_prompt(&session_id)
            .map_err(|error| RuntimeError::Provider(error.to_string()))?;
        Ok(json!({}))
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        config_id: String,
        value: String,
    ) -> Result<Value> {
        serialize(
            self.service
                .set_session_config_option(&session_id, &config_id, &value),
        )
    }

    fn session_respond_interaction(
        &mut self,
        session_id: String,
        interaction_id: String,
        response: InteractionResponse,
    ) -> Result<Value> {
        self.service
            .respond_interaction(&session_id, &interaction_id, response)
            .map_err(map_acp_error)?;
        Ok(json!({
            "sessionId": session_id,
            "interactionId": interaction_id
        }))
    }
}

fn serialize<T>(result: acp_core::Result<T>) -> Result<Value>
where
    T: Serialize,
{
    let value = result.map_err(map_acp_error)?;
    to_value(value).map_err(|error| RuntimeError::Provider(error.to_string()))
}

fn map_acp_error(error: acp_core::AcpError) -> RuntimeError {
    match error {
        acp_core::AcpError::UnknownInteraction { .. } => RuntimeError::InvalidParameter {
            command: "session/respond_interaction",
            parameter: "interactionId",
            message: "interaction_unknown",
        },
        acp_core::AcpError::ResolvedInteraction { .. } => RuntimeError::InvalidParameter {
            command: "session/respond_interaction",
            parameter: "interactionId",
            message: "interaction_resolved",
        },
        acp_core::AcpError::InvalidInteractionResponse { .. } => RuntimeError::InvalidParameter {
            command: "session/respond_interaction",
            parameter: "response",
            message: "invalid_interaction_response",
        },
        error => RuntimeError::Provider(error.to_string()),
    }
}
