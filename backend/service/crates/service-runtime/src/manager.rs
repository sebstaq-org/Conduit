//! Provider manager and command dispatcher.

mod interaction_response;
mod logging;
mod prompt_flow;
mod provider_lifecycle;

use self::interaction_response::parse_interaction_response;
use self::provider_lifecycle::initialize_provider_port;
use crate::command::ConsumerCommand;
use crate::command::ConsumerResponse;
use crate::error::{
    RuntimeError, optional_string_param, optional_u64_param, path_param, string_param,
};
use crate::event::{EventBuffer, RuntimeEvent, RuntimeEventKind};
use crate::manager_helpers::{
    absolute_normalized_cwd, loaded_transcript_snapshot_updates, parse_provider,
};
use crate::manager_response::{
    session_new_result_id, session_open_or_new_result, session_open_result,
    session_set_config_option_result, session_state_from_provider_result, store_lock_error,
};
use crate::session_groups::providers_from_target;
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use session_store::{HistoryLimit, LocalStore, OpenSessionKey, SessionIndexEntry};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    pub(crate) event_buffer: EventBuffer,
    factory: F,
    loaded_provider_sessions: HashSet<OpenSessionKey>,
    session_states: HashMap<OpenSessionKey, Value>,
    pub(crate) session_index_refreshes: HashMap<ProviderId, u64>,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
    pub(crate) local_store: LocalStore,
    pub(crate) store_lock: Arc<Mutex<()>>,
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
        let mut first_error = None;
        for provider in providers {
            if self.session_index_refresh_due(provider)
                && let Err(error) = self.refresh_session_index_provider(provider)
                && first_error.is_none()
            {
                first_error = Some(error);
            }
        }
        if let Some(error) = first_error {
            return Err(error);
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
        let mut first_error = None;
        for provider in providers_from_target(provider_target)? {
            if let Err(error) = self.refresh_session_index_provider(provider)
                && first_error.is_none()
            {
                first_error = Some(error);
            }
        }
        if let Some(error) = first_error {
            return Err(error);
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
            "session/respond_interaction" => {
                Self::require_global_provider("session/respond_interaction", &command.provider)?;
                Some(self.session_respond_interaction(command.id.clone(), &command.params)?)
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
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = initialize_provider_port(provider_port.as_mut())?;
            (result, provider_port.snapshot())
        };
        Ok(ConsumerResponse::success(id, to_value(&result)?, snapshot))
    }

    fn session_new(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let cwd =
            absolute_normalized_cwd("session/new", path_param("session/new", params, "cwd")?)?;
        let limit = HistoryLimit::new(
            "session/new",
            optional_u64_param("session/new", params, "limit")?,
        )?;
        let (provider_result, snapshot) = {
            let provider_port = self.initialized_provider(provider)?;
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
        let session_state = session_state_from_provider_result(&session_id, &provider_result);
        self.session_states
            .insert(key.clone(), session_state.clone());
        let (history, index_revision) = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            let history = self.local_store.open_session(key.clone(), &[], limit)?;
            self.local_store
                .set_open_session_state(&key, &session_state)?;
            let updated_at = self.local_store.current_timestamp()?;
            let index_revision =
                self.local_store
                    .upsert_session_index_entry(&SessionIndexEntry {
                        provider,
                        session_id: session_id.clone(),
                        cwd: key.cwd.clone(),
                        title: session_new_title(&provider_result),
                        updated_at: Some(updated_at),
                    })?;
            (history, index_revision)
        };
        if let Some(revision) = index_revision {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionsIndexChanged,
                None,
                json!({ "revision": revision }),
            );
        }
        let history = to_value(history)?;
        let result = session_open_or_new_result(&session_state, &history);
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_list(&mut self, id: String, provider: ProviderId) -> Result<ConsumerResponse> {
        let (result, snapshot) = {
            let provider_port = self.initialized_provider(provider)?;
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
            let provider_port = self.initialized_provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd.clone())?;
            (result, provider_port.snapshot())
        };
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        self.loaded_provider_sessions.insert(key.clone());
        self.session_states.insert(
            key,
            session_state_from_provider_result(&session_id, &result),
        );
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_open(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/open", params, "sessionId")?;
        let cwd =
            absolute_normalized_cwd("session/open", path_param("session/open", params, "cwd")?)?;
        let requested_limit = optional_u64_param("session/open", params, "limit")?;
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
            tracing::debug!(
                event_name = "session_open.cache",
                source = "service-runtime",
                command_id = %id,
                provider = %provider.as_str(),
                session_id = %session_id,
                cwd = %cwd.display(),
                requested_limit = ?requested_limit,
                cache_hit = true
            );
            let state = self.resolve_session_open_state(provider, &session_id, &cwd, &key)?;
            let history = to_value(cached)?;
            return Ok(ConsumerResponse::success_without_snapshot(
                id,
                session_open_result(&state, &history),
            ));
        }
        tracing::debug!(
            event_name = "session_open.cache",
            source = "service-runtime",
            command_id = %id,
            provider = %provider.as_str(),
            session_id = %session_id,
            cwd = %cwd.display(),
            requested_limit = ?requested_limit,
            cache_hit = false
        );
        let (provider_result, snapshot) = {
            let provider_port = self.initialized_provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd)?;
            (result, provider_port.snapshot())
        };
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_state_from_provider_result(&session_id, &provider_result);
        self.session_states.insert(key.clone(), state.clone());
        let updates = loaded_transcript_snapshot_updates(&snapshot, &session_id);
        let history = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            let history = self.local_store.open_session(key.clone(), updates, limit)?;
            self.local_store.set_open_session_state(&key, &state)?;
            to_value(history)?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            session_open_result(&state, &history),
        ))
    }

    fn session_set_config_option(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let session_id = string_param("session/set_config_option", params, "sessionId")?;
        let config_id = string_param("session/set_config_option", params, "configId")?;
        let value = string_param("session/set_config_option", params, "value")?;
        let (provider_result, snapshot) = {
            let provider_port = self.initialized_provider(provider)?;
            let result = provider_port.session_set_config_option(
                session_id.clone(),
                config_id,
                value.to_owned(),
            )?;
            (result, provider_port.snapshot())
        };
        let result = session_set_config_option_result(&session_id, &provider_result)?;
        let Some(config_options) = result.get("configOptions").cloned() else {
            return Err(RuntimeError::Provider(
                "session/set_config_option result missing configOptions".to_owned(),
            ));
        };
        let keys: Vec<OpenSessionKey> = self
            .session_states
            .keys()
            .filter(|key| key.provider == provider && key.session_id == session_id)
            .cloned()
            .collect();
        for key in keys {
            if let Some(state) = self.session_states.get_mut(&key)
                && let Some(map) = state.as_object_mut()
            {
                map.insert("configOptions".to_owned(), config_options.clone());
            }
        }
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_history(&mut self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let open_session_id = string_param("session/history", params, "openSessionId")?;
        let limit = HistoryLimit::new(
            "session/history",
            optional_u64_param("session/history", params, "limit")?,
        )?;
        let cursor = optional_string_param("session/history", params, "cursor")?;
        let result = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            to_value(
                self.local_store
                    .history_window(&open_session_id, cursor, limit)?,
            )?
        };
        Ok(ConsumerResponse::success_without_snapshot(id, result))
    }

    fn session_watch(&self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let open_session_id = string_param("session/watch", params, "openSessionId")?;
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        if self.local_store.provider_for(&open_session_id)?.is_none() {
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
                "openSessionId": open_session_id
            }),
        ))
    }

    fn session_respond_interaction(
        &mut self,
        id: String,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let open_session_id = string_param("session/respond_interaction", params, "openSessionId")?;
        let interaction_id = string_param("session/respond_interaction", params, "interactionId")?;
        let response = parse_interaction_response(params)?;
        let key = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .open_session_key("session/respond_interaction", &open_session_id)?
        };
        let provider_response = {
            let provider_port = self.initialized_provider(key.provider)?;
            provider_port.session_respond_interaction(
                key.session_id.clone(),
                interaction_id.clone(),
                response,
            )?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            json!({
                "openSessionId": open_session_id,
                "sessionId": key.session_id,
                "interactionId": interaction_id,
                "providerResult": provider_response
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
            let provider_port = self.initialized_provider(provider)?;
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

    fn resolve_session_open_state(
        &mut self,
        provider: ProviderId,
        session_id: &str,
        cwd: &Path,
        key: &OpenSessionKey,
    ) -> Result<Value> {
        if let Some(state) = self.session_states.get(key).cloned() {
            return Ok(state);
        }
        if let Some(state) = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.open_session_state(key)?
        } {
            self.session_states.insert(key.clone(), state.clone());
            return Ok(state);
        }
        let provider_result = {
            let provider_port = self.initialized_provider(provider)?;
            provider_port.session_load(session_id.to_owned(), cwd.to_path_buf())?
        };
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_state_from_provider_result(session_id, &provider_result);
        self.session_states.insert(key.clone(), state.clone());
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        self.local_store.set_open_session_state(key, &state)?;
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
                self.session_states.insert(key.clone(), state);
            }
            return Ok(());
        }
        let cwd = PathBuf::from(&key.cwd);
        let result = {
            let provider_port = self.initialized_provider(key.provider)?;
            provider_port.session_load(key.session_id.clone(), cwd)
        };
        let result = result?;
        self.loaded_provider_sessions.insert(key.clone());
        let state = session_state_from_provider_result(&key.session_id, &result);
        self.session_states.insert(key.clone(), state.clone());
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        self.local_store.set_open_session_state(key, &state)?;
        Ok(())
    }
}

fn session_new_title(result: &Value) -> Option<String> {
    result
        .get("title")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}
