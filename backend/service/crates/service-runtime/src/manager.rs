//! Provider manager and command dispatcher.

mod logging;
mod prompt_flow;

use crate::command::ConsumerCommand;
use crate::command::ConsumerResponse;
use crate::contracts::{
    SessionHistoryRequest, SessionNewRequest, SessionOpenRequest, SessionSetConfigOptionRequest,
    SessionStateProjection, SessionWatchRequest, from_params, to_contract_value,
};
use crate::error::{RuntimeError, path_param, string_param};
use crate::event::{EventBuffer, RuntimeEvent};
use crate::manager_helpers::{
    absolute_normalized_cwd, loaded_transcript_snapshot_updates, parse_provider,
};
use crate::manager_response::{
    session_new_result, session_new_result_id, session_new_state, session_open_result,
    session_open_state, session_set_config_option_result, store_lock_error,
};
use crate::session_groups::providers_from_target;
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_core::ConnectionState;
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use session_store::{HistoryLimit, LocalStore, OpenSessionKey};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    pub(crate) event_buffer: EventBuffer,
    factory: F,
    loaded_provider_sessions: HashSet<OpenSessionKey>,
    session_states: HashMap<OpenSessionKey, SessionStateProjection>,
    pub(crate) session_index_refreshes: HashMap<ProviderId, u64>,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
    pub(crate) local_store: LocalStore,
    pub(crate) store_lock: Arc<Mutex<()>>,
}

struct SessionOpenCacheLog<'a> {
    command_id: &'a str,
    provider: ProviderId,
    session_id: &'a str,
    cwd: &'a Path,
    requested_limit: Option<u64>,
    cache_hit: bool,
}

fn log_session_open_cache(event: SessionOpenCacheLog<'_>) {
    tracing::debug!(
        event_name = "session_open.cache",
        source = "service-runtime",
        command_id = %event.command_id,
        provider = %event.provider.as_str(),
        session_id = %event.session_id,
        cwd = %event.cwd.display(),
        requested_limit = ?event.requested_limit,
        cache_hit = event.cache_hit
    );
}

impl ServiceRuntime<AppServiceFactory> {
    /// Creates a consumer runtime backed by real provider services.
    #[must_use]
    pub fn new(local_store: LocalStore) -> Self {
        Self::with_factory(AppServiceFactory::default(), local_store)
    }
}

impl<F> ServiceRuntime<F>
where
    F: ProviderFactory,
{
    fn require_global_provider(command: &'static str, provider: &str) -> Result<()> {
        if provider == "all" {
            return Ok(());
        }
        Err(RuntimeError::InvalidParameter {
            command,
            parameter: "provider",
            message: "must be all",
        })
    }

    /// Creates a consumer runtime with an explicit provider factory.
    pub fn with_factory(factory: F, local_store: LocalStore) -> Self {
        Self::with_factory_and_store_lock(factory, local_store, Arc::new(Mutex::new(())))
    }

    /// Creates a consumer runtime with an explicit provider factory and shared store lock.
    pub fn with_factory_and_store_lock(
        factory: F,
        local_store: LocalStore,
        store_lock: Arc<Mutex<()>>,
    ) -> Self {
        Self {
            event_buffer: EventBuffer::new(),
            factory,
            loaded_provider_sessions: HashSet::new(),
            session_states: HashMap::new(),
            session_index_refreshes: HashMap::new(),
            providers: HashMap::new(),
            local_store,
            store_lock,
        }
    }

    /// Drains recorded runtime events.
    pub fn drain_events(&mut self) -> Vec<RuntimeEvent> {
        self.event_buffer.drain()
    }

    /// Returns runtime events after the supplied sequence cursor.
    #[must_use]
    pub fn events_after(&self, sequence: u64) -> Vec<RuntimeEvent> {
        self.event_buffer.events_after(sequence)
    }

    /// Returns the latest emitted event sequence.
    #[must_use]
    pub fn latest_event_sequence(&self) -> u64 {
        self.event_buffer.latest_sequence()
    }

    /// Installs a live event sink for product transports.
    pub fn set_event_sink(&mut self, sink: Box<dyn FnMut(RuntimeEvent) + Send>) {
        self.event_buffer.set_sink(sink);
    }

    /// Dispatches one command and converts errors into stable envelopes.
    pub fn dispatch(&mut self, command: ConsumerCommand) -> ConsumerResponse {
        let command_id = command.id.clone();
        let command_name = command.command.clone();
        let provider = command.provider.clone();
        let params = command.params.clone();
        let started_at = Instant::now();

        tracing::debug!(
            event_name = "command.start",
            source = "service-runtime",
            command_id = %command_id,
            command = %command_name,
            provider = %provider,
            params = ?params
        );

        let response = match self.dispatch_result(command) {
            Ok(response) => response,
            Err(error) => {
                ConsumerResponse::failure(command_id.clone(), error.code(), error.to_string())
            }
        };
        logging::log_command_response(
            &command_id,
            &command_name,
            &provider,
            &response,
            started_at.elapsed().as_millis(),
        );
        response
    }

    /// Refreshes read models after a fast response has already been sent.
    ///
    /// # Errors
    ///
    /// Returns an error when a provider refresh fails.
    pub fn refresh_after_response(&mut self, command: &ConsumerCommand) -> Result<()> {
        if command.command != "sessions/grouped" {
            return Ok(());
        }
        let providers = providers_from_target(&command.provider)?;
        for provider in providers {
            if self.session_index_refresh_due(provider) {
                self.refresh_session_index_provider(provider)?;
            }
        }
        Ok(())
    }

    /// Forces a sessions index refresh for a provider target.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider target is invalid or a provider
    /// refresh fails.
    pub fn force_refresh_session_index(&mut self, provider_target: &str) -> Result<()> {
        for provider in providers_from_target(provider_target)? {
            self.refresh_session_index_provider(provider)?;
        }
        Ok(())
    }

    fn dispatch_global_command(
        &mut self,
        command: &ConsumerCommand,
    ) -> Result<Option<ConsumerResponse>> {
        let response = match command.command.as_str() {
            "sessions/grouped" => Some(self.sessions_grouped(
                command.id.clone(),
                &command.provider,
                &command.params,
            )?),
            "sessions/watch" => {
                Self::require_global_provider("sessions/watch", &command.provider)?;
                Some(self.sessions_watch(command.id.clone())?)
            }
            "projects/list" => {
                Self::require_global_provider("projects/list", &command.provider)?;
                Some(self.projects_list(command.id.clone())?)
            }
            "projects/suggestions" => {
                Self::require_global_provider("projects/suggestions", &command.provider)?;
                Some(self.projects_suggestions(command.id.clone(), &command.params)?)
            }
            "projects/add" => {
                Self::require_global_provider("projects/add", &command.provider)?;
                Some(self.projects_add(command.id.clone(), &command.params)?)
            }
            "projects/remove" => {
                Self::require_global_provider("projects/remove", &command.provider)?;
                Some(self.projects_remove(command.id.clone(), &command.params)?)
            }
            "projects/update" => {
                Self::require_global_provider("projects/update", &command.provider)?;
                Some(self.projects_update(command.id.clone(), &command.params)?)
            }
            "settings/get" => {
                Self::require_global_provider("settings/get", &command.provider)?;
                Some(self.settings_get(command.id.clone())?)
            }
            "settings/update" => {
                Self::require_global_provider("settings/update", &command.provider)?;
                Some(self.settings_update(command.id.clone(), &command.params)?)
            }
            "session/history" => {
                Self::require_global_provider("session/history", &command.provider)?;
                Some(self.session_history(command.id.clone(), &command.params)?)
            }
            "session/watch" => {
                Self::require_global_provider("session/watch", &command.provider)?;
                Some(self.session_watch(command.id.clone(), &command.params)?)
            }
            "session/prompt" => {
                Self::require_global_provider("session/prompt", &command.provider)?;
                Some(self.session_prompt(command.id.clone(), &command.params)?)
            }
            _ => None,
        };
        Ok(response)
    }

    fn dispatch_result(&mut self, command: ConsumerCommand) -> Result<ConsumerResponse> {
        if let Some(response) = self.dispatch_global_command(&command)? {
            return Ok(response);
        }
        let provider = parse_provider(&command.provider)?;
        match command.command.as_str() {
            "initialize" => self.initialize(command.id, provider),
            "session/new" => self.session_new(command.id, provider, &command.params),
            "session/list" => self.session_list(command.id, provider),
            "session/load" => self.session_load(command.id, provider, &command.params),
            "session/open" => self.session_open(command.id, provider, &command.params),
            "session/set_config_option" => {
                self.session_set_config_option(command.id, provider, &command.params)
            }
            "session/cancel" => self.session_cancel(command.id, provider, &command.params),
            "provider/disconnect" => self.provider_disconnect(command.id, provider),
            _ => Err(RuntimeError::UnsupportedCommand(command.command)),
        }
    }

    fn initialize(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let snapshot = {
            let provider_port = self.provider(provider)?;
            provider_port.snapshot()
        };
        Ok(ConsumerResponse::success(
            id,
            to_contract_value("ProviderSnapshot", &snapshot)?,
            snapshot,
        ))
    }

    fn session_new(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let request = from_params::<SessionNewRequest>("session/new", "SessionNewRequest", params)?;
        let cwd = absolute_normalized_cwd("session/new", PathBuf::from(request.cwd))?;
        let limit = HistoryLimit::new("session/new", request.limit)?;
        let (provider_result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_new(cwd.clone())?;
            (result, provider_port.snapshot())
        };
        let session_id = session_new_result_id(&provider_result)?;
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        self.loaded_provider_sessions.insert(key.clone());
        let session_state = session_new_state(&session_id, &provider_result)?;
        self.session_states
            .insert(key.clone(), session_state.clone());
        let history = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            let history = self.local_store.open_session(key.clone(), &[], limit)?;
            self.local_store
                .set_open_session_state(&key, &serde_json::to_value(&session_state)?)?;
            history
        };
        let result = session_new_result(&session_state, history)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_list(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_list(None, None)?;
            (result, provider_port.snapshot())
        };
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_load(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = params
            .get("session_id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .or_else(|| {
                params
                    .get("sessionId")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .ok_or(RuntimeError::MissingParameter {
                command: "session/load",
                parameter: "session_id",
            })?;
        let cwd =
            absolute_normalized_cwd("session/load", path_param("session/load", params, "cwd")?)?;
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd.clone())?;
            (result, provider_port.snapshot())
        };
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        self.loaded_provider_sessions.insert(key.clone());
        self.session_states
            .insert(key, session_open_state(&session_id, &result)?);
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_open(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let request =
            from_params::<SessionOpenRequest>("session/open", "SessionOpenRequest", params)?;
        let session_id = request.session_id;
        let cwd = absolute_normalized_cwd("session/open", PathBuf::from(request.cwd))?;
        let requested_limit = request.limit;
        let limit = HistoryLimit::new("session/open", requested_limit)?;
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        if let Some(cached) = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.cached_session(&key, limit)?
        } {
            log_session_open_cache(SessionOpenCacheLog {
                command_id: &id,
                provider,
                session_id: &session_id,
                cwd: &cwd,
                requested_limit,
                cache_hit: true,
            });
            let state = self.resolve_session_open_state(provider, &session_id, &cwd, &key)?;
            return Ok(ConsumerResponse::success_without_snapshot(
                id,
                session_open_result(&state, cached)?,
            ));
        }
        log_session_open_cache(SessionOpenCacheLog {
            command_id: &id,
            provider,
            session_id: &session_id,
            cwd: &cwd,
            requested_limit,
            cache_hit: false,
        });
        let (provider_result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd)?;
            (result, provider_port.snapshot())
        };
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_open_state(&session_id, &provider_result)?;
        self.session_states.insert(key.clone(), state.clone());
        let updates = loaded_transcript_snapshot_updates(&snapshot, &session_id);
        let history = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            let history = self.local_store.open_session(key.clone(), updates, limit)?;
            self.local_store
                .set_open_session_state(&key, &serde_json::to_value(&state)?)?;
            history
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            session_open_result(&state, history)?,
        ))
    }

    fn session_set_config_option(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let request = from_params::<SessionSetConfigOptionRequest>(
            "session/set_config_option",
            "SessionSetConfigOptionRequest",
            params,
        )?;
        let session_id = request.session_id;
        let (provider_result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_set_config_option(
                session_id.clone(),
                request.config_id,
                request.value,
            )?;
            (result, provider_port.snapshot())
        };
        let result = session_set_config_option_result(&session_id, &provider_result)?;
        let typed_result =
            serde_json::from_value::<crate::contracts::SessionSetConfigOptionResult>(
                result.clone(),
            )
            .map_err(|error| RuntimeError::Provider(error.to_string()))?;
        let keys: Vec<OpenSessionKey> = self
            .session_states
            .keys()
            .filter(|key| key.provider == provider && key.session_id == session_id)
            .cloned()
            .collect();
        for key in keys {
            if let Some(state) = self.session_states.get_mut(&key) {
                state.config_options = Some(typed_result.config_options.clone());
            }
        }
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_history(&mut self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let request = from_params::<SessionHistoryRequest>(
            "session/history",
            "SessionHistoryRequest",
            params,
        )?;
        let limit = HistoryLimit::new("session/history", request.limit)?;
        let result = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .history_window(&request.open_session_id, request.cursor, limit)?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_contract_value("SessionHistoryWindow", &result)?,
        ))
    }

    fn session_watch(&self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let request =
            from_params::<SessionWatchRequest>("session/watch", "SessionWatchRequest", params)?;
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        if self
            .local_store
            .provider_for(&request.open_session_id)?
            .is_none()
        {
            return Err(RuntimeError::InvalidParameter {
                command: "session/watch",
                parameter: "openSessionId",
                message: "open session is unknown",
            });
        }
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            json!({
                "subscribed": true,
                "openSessionId": request.open_session_id
            }),
        ))
    }

    fn session_cancel(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/cancel", params, "session_id")?;
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_cancel(session_id)?;
            (result, provider_port.snapshot())
        };
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn provider_disconnect(
        &mut self,
        id: String,
        provider: ProviderId,
    ) -> Result<ConsumerResponse> {
        let snapshot = {
            let provider_port = self.provider(provider)?;
            provider_port.disconnect()?;
            provider_port.snapshot()
        };
        self.providers.remove(&provider);
        self.loaded_provider_sessions
            .retain(|key| key.provider != provider);
        self.session_states
            .retain(|key, _| key.provider != provider);
        Ok(ConsumerResponse::success(id, json!({}), snapshot))
    }

    pub(crate) fn provider(&mut self, provider: ProviderId) -> Result<&mut Box<dyn ProviderPort>> {
        if self
            .providers
            .get(&provider)
            .is_some_and(|entry| entry.snapshot().connection_state == ConnectionState::Disconnected)
        {
            self.providers.remove(&provider);
            self.loaded_provider_sessions
                .retain(|key| key.provider != provider);
            self.session_states
                .retain(|key, _| key.provider != provider);
        }
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .get_mut(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    fn take_provider(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        if self
            .providers
            .get(&provider)
            .is_some_and(|entry| entry.snapshot().connection_state == ConnectionState::Disconnected)
        {
            self.providers.remove(&provider);
            self.loaded_provider_sessions
                .retain(|key| key.provider != provider);
            self.session_states
                .retain(|key, _| key.provider != provider);
        }
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .remove(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    fn resolve_session_open_state(
        &mut self,
        provider: ProviderId,
        session_id: &str,
        cwd: &Path,
        key: &OpenSessionKey,
    ) -> Result<SessionStateProjection> {
        if let Some(state) = self.session_states.get(key).cloned() {
            return Ok(state);
        }
        if let Some(state) = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.open_session_state(key)?
        } {
            let state =
                serde_json::from_value::<SessionStateProjection>(state).map_err(|error| {
                    RuntimeError::ContractViolation {
                        contract: "SessionStateProjection",
                        message: error.to_string(),
                    }
                })?;
            self.session_states.insert(key.clone(), state.clone());
            return Ok(state);
        }
        let provider_result = {
            let provider_port = self.provider(provider)?;
            provider_port.session_load(session_id.to_owned(), cwd.to_path_buf())?
        };
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_open_state(session_id, &provider_result)?;
        self.session_states.insert(key.clone(), state.clone());
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        self.local_store
            .set_open_session_state(key, &serde_json::to_value(&state)?)?;
        Ok(state)
    }

    fn ensure_provider_session_loaded(&mut self, key: &OpenSessionKey) -> Result<()> {
        if self.loaded_provider_sessions.contains(key) {
            return Ok(());
        }
        let provider_tracks_live_session = {
            let provider_port = self.provider(key.provider)?;
            provider_port
                .snapshot()
                .live_sessions
                .iter()
                .any(|session| {
                    session.identity.provider == key.provider
                        && session.identity.acp_session_id == key.session_id
                })
        };
        if provider_tracks_live_session {
            self.loaded_provider_sessions.insert(key.clone());
            if !self.session_states.contains_key(key)
                && let Some(state) = {
                    let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
                    self.local_store.open_session_state(key)?
                }
            {
                let state =
                    serde_json::from_value::<SessionStateProjection>(state).map_err(|error| {
                        RuntimeError::ContractViolation {
                            contract: "SessionStateProjection",
                            message: error.to_string(),
                        }
                    })?;
                self.session_states.insert(key.clone(), state);
            }
            return Ok(());
        }
        let cwd = PathBuf::from(&key.cwd);
        let result = {
            let provider_port = self.provider(key.provider)?;
            provider_port.session_load(key.session_id.clone(), cwd)
        };
        let result = result?;
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_open_state(&key.session_id, &result)?;
        self.session_states.insert(key.clone(), state.clone());
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        self.local_store
            .set_open_session_state(key, &serde_json::to_value(&state)?)?;
        Ok(())
    }
}
