//! Provider manager and command dispatcher.

use crate::command::{ConsumerCommand, ConsumerResponse};
use crate::error::{RuntimeError, path_param, string_param};
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use std::collections::HashMap;
use std::str::FromStr;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    factory: F,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
}

impl ServiceRuntime<AppServiceFactory> {
    /// Creates a consumer runtime backed by real provider services.
    #[must_use]
    pub fn new() -> Self {
        Self::with_factory(AppServiceFactory)
    }
}

impl Default for ServiceRuntime<AppServiceFactory> {
    fn default() -> Self {
        Self::new()
    }
}

impl<F> ServiceRuntime<F>
where
    F: ProviderFactory,
{
    /// Creates a consumer runtime with an explicit provider factory.
    pub fn with_factory(factory: F) -> Self {
        Self {
            factory,
            providers: HashMap::new(),
        }
    }

    /// Dispatches one command and converts errors into stable envelopes.
    pub fn dispatch(&mut self, command: ConsumerCommand) -> ConsumerResponse {
        let id = command.id.clone();
        match self.dispatch_result(command) {
            Ok(response) => response,
            Err(error) => ConsumerResponse::failure(id, error.code(), error.to_string()),
        }
    }

    fn dispatch_result(&mut self, command: ConsumerCommand) -> Result<ConsumerResponse> {
        let provider = parse_provider(&command.provider)?;
        match command.command.as_str() {
            "initialize" => self.initialize(command.id, provider),
            "session/new" => self.session_new(command.id, provider, &command.params),
            "session/list" => self.session_list(command.id, provider),
            "session/load" => self.session_load(command.id, provider, &command.params),
            "session/prompt" => self.session_prompt(command.id, provider, &command.params),
            "session/cancel" => self.session_cancel(command.id, provider, &command.params),
            "provider/snapshot" => self.provider_snapshot(command.id, provider),
            "provider/disconnect" => self.provider_disconnect(command.id, provider),
            "events/subscribe" => self.events_subscribe(command.id, provider),
            _ => Err(RuntimeError::UnsupportedCommand(command.command)),
        }
    }

    fn initialize(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let provider_port = self.provider(provider)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(
            id,
            to_value(&snapshot)?,
            snapshot,
        ))
    }

    fn session_new(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let cwd = path_param("session/new", params, "cwd")?;
        let provider_port = self.provider(provider)?;
        let result = provider_port.session_new(cwd)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_list(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let provider_port = self.provider(provider)?;
        let result = provider_port.session_list()?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_load(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/load", params, "session_id")?;
        let cwd = path_param("session/load", params, "cwd")?;
        let provider_port = self.provider(provider)?;
        let result = provider_port.session_load(session_id, cwd)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_prompt(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/prompt", params, "session_id")?;
        let prompt = string_param("session/prompt", params, "prompt")?;
        let provider_port = self.provider(provider)?;
        let result = provider_port.session_prompt(session_id, prompt)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_cancel(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/cancel", params, "session_id")?;
        let provider_port = self.provider(provider)?;
        let result = provider_port.session_cancel(session_id)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn provider_snapshot(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let provider_port = self.provider(provider)?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(
            id,
            to_value(&snapshot)?,
            snapshot,
        ))
    }

    fn provider_disconnect(
        &mut self,
        id: String,
        provider: ProviderId,
    ) -> Result<ConsumerResponse> {
        let provider_port = self.provider(provider)?;
        provider_port.disconnect()?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, json!({}), snapshot))
    }

    fn events_subscribe(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let provider_port = self.provider(provider)?;
        let result = to_value(provider_port.raw_events())?;
        let snapshot = provider_port.snapshot();
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn provider(&mut self, provider: ProviderId) -> Result<&mut Box<dyn ProviderPort>> {
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .get_mut(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }
}

fn parse_provider(value: &str) -> Result<ProviderId> {
    ProviderId::from_str(value).map_err(|message| RuntimeError::UnknownProvider {
        provider: value.to_owned(),
        message,
    })
}

impl From<serde_json::Error> for RuntimeError {
    fn from(error: serde_json::Error) -> Self {
        Self::Provider(error.to_string())
    }
}
