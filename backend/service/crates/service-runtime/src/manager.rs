//! Provider manager and command dispatcher.

use crate::command::{
    ConsumerCommand, ConsumerResponse, session_id_from_value, session_ids_from_list,
};
use crate::error::{RuntimeError, path_param, string_param};
use crate::event::{EventBuffer, RuntimeEvent, RuntimeEventKind};
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use std::collections::HashMap;
use std::str::FromStr;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    event_buffer: EventBuffer,
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
            event_buffer: EventBuffer::new(),
            factory,
            providers: HashMap::new(),
        }
    }

    /// Drains recorded runtime events.
    pub fn drain_events(&mut self) -> Vec<RuntimeEvent> {
        self.event_buffer.drain()
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
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::ProviderConnected,
            None,
            json!({}),
        );
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
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
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_new(cwd)?;
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        if let Some(session_id) = session_id_from_value(&result) {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionObserved,
                Some(session_id),
                json!({ "observed_via": "session/new" }),
            );
        }
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_list(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_list()?;
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        for session_id in session_ids_from_list(&result) {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionObserved,
                Some(session_id),
                json!({ "observed_via": "session/list" }),
            );
        }
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
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
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd)?;
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::SessionObserved,
            Some(session_id),
            json!({ "observed_via": "session/load" }),
        );
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
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
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::PromptStarted,
            Some(session_id.clone()),
            json!({ "prompt": prompt }),
        );
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_prompt(session_id.clone(), prompt)?;
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::PromptUpdateObserved,
            Some(session_id.clone()),
            json!({ "source": "provider_response" }),
        );
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::PromptCompleted,
            Some(session_id),
            result.clone(),
        );
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_cancel(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/cancel", params, "session_id")?;
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::CancelSent,
            Some(session_id.clone()),
            json!({ "command": "session/cancel" }),
        );
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_cancel(session_id)?;
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn provider_snapshot(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
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
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            provider_port.disconnect()?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::ProviderDisconnected,
            None,
            json!({}),
        );
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(ConsumerResponse::success(id, json!({}), snapshot))
    }

    fn events_subscribe(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        let result = json!({
            "events": self.event_buffer.events(),
            "raw_wire_events": raw_events,
        });
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
