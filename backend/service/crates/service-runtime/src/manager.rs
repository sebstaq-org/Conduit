//! Provider manager and command dispatcher.

use crate::command::ConsumerCommand;
use crate::command::ConsumerResponse;
use crate::error::{
    RuntimeError, optional_string_param, optional_u64_param, path_param, string_param,
};
use crate::event::{EventBuffer, RuntimeEvent, RuntimeEventKind};
use crate::manager_helpers::{
    absolute_normalized_cwd, content_blocks_param, loaded_transcript_snapshot_updates,
    parse_provider, prompt_lifecycle, prompt_status,
};
use crate::session_groups::providers_from_target;
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_core::{ConnectionState, ProviderSnapshot, TranscriptUpdateSnapshot};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use session_store::{
    HistoryLimit, LocalStore, OpenSessionKey, PromptTurnAppend, PromptTurnMutation,
    PromptTurnReplace, TranscriptItemStatus,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    pub(crate) event_buffer: EventBuffer,
    factory: F,
    loaded_provider_sessions: HashSet<OpenSessionKey>,
    pub(crate) session_index_refreshes: HashMap<ProviderId, u64>,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
    pub(crate) local_store: LocalStore,
    pub(crate) store_lock: Arc<Mutex<()>>,
}

struct SessionPromptTarget {
    open_session_id: String,
    key: OpenSessionKey,
}

#[derive(Clone, Copy)]
struct PromptTurnContext<'a> {
    provider: ProviderId,
    target: &'a SessionPromptTarget,
    turn_id: &'a str,
    prompt: &'a [Value],
}

struct PromptTurnProjection<'a> {
    context: PromptTurnContext<'a>,
    updates: &'a [TranscriptUpdateSnapshot],
    status: TranscriptItemStatus,
    stop_reason: Option<&'a str>,
}

struct ProviderPromptRun {
    result: Result<Value>,
    snapshot: ProviderSnapshot,
}

struct TimelineMutationEvent<'a> {
    provider: ProviderId,
    session_id: &'a str,
    open_session_id: &'a str,
    revision: i64,
    items: &'a [session_store::TranscriptItem],
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
        let id = command.id.clone();
        match self.dispatch_result(command) {
            Ok(response) => response,
            Err(error) => ConsumerResponse::failure(id, error.code(), error.to_string()),
        }
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

    fn dispatch_result(&mut self, command: ConsumerCommand) -> Result<ConsumerResponse> {
        if command.command == "sessions/grouped" {
            return self.sessions_grouped(command.id, &command.provider, &command.params);
        }
        if command.command == "sessions/watch" {
            return self.sessions_watch(command.id);
        }
        if command.command == "projects/list" {
            return self.projects_list(command.id);
        }
        if command.command == "projects/suggestions" {
            return self.projects_suggestions(command.id, &command.params);
        }
        if command.command == "projects/add" {
            return self.projects_add(command.id, &command.params);
        }
        if command.command == "projects/remove" {
            return self.projects_remove(command.id, &command.params);
        }
        if command.command == "session/history" {
            return self.session_history(command.id, &command.params);
        }
        if command.command == "session/watch" {
            return self.session_watch(command.id, &command.params);
        }
        if command.command == "session/prompt" {
            return self.session_prompt(command.id, &command.params);
        }
        let provider = parse_provider(&command.provider)?;
        match command.command.as_str() {
            "initialize" => self.initialize(command.id, provider),
            "session/new" => self.session_new(command.id, provider, &command.params),
            "session/list" => self.session_list(command.id, provider),
            "session/load" => self.session_load(command.id, provider, &command.params),
            "session/open" => self.session_open(command.id, provider, &command.params),
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
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_new(cwd)?;
            (result, provider_port.snapshot())
        };
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
        let session_id = string_param("session/load", params, "session_id")?;
        let cwd =
            absolute_normalized_cwd("session/load", path_param("session/load", params, "cwd")?)?;
        let (result, snapshot) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_load(session_id.clone(), cwd.clone())?;
            (result, provider_port.snapshot())
        };
        self.loaded_provider_sessions.insert(OpenSessionKey {
            provider,
            session_id,
            cwd: cwd.display().to_string(),
        });
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
        let limit = HistoryLimit::new(
            "session/open",
            optional_u64_param("session/open", params, "limit")?,
        )?;
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        if let Some(result) = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.cached_session(&key, limit)?
        } {
            return Ok(ConsumerResponse::success_without_snapshot(
                id,
                to_value(result)?,
            ));
        }
        let snapshot = {
            let provider_port = self.provider(provider)?;
            let _result = provider_port.session_load(session_id.clone(), cwd)?;
            provider_port.snapshot()
        };
        self.loaded_provider_sessions.insert(key.clone());
        let updates = loaded_transcript_snapshot_updates(&snapshot, &session_id);
        let result = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            to_value(self.local_store.open_session(key, updates, limit)?)?
        };
        Ok(ConsumerResponse::success_without_snapshot(id, result))
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

    fn session_prompt(&mut self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let target = self.session_prompt_target(params)?;
        let provider = target.key.provider;
        let prompt = content_blocks_param("session/prompt", params, "prompt")?;
        if let Err(error) = self.ensure_provider_session_loaded(&target.key) {
            self.append_failed_prompt_turn(provider, &target, &prompt)?;
            return Err(error);
        }
        let prompt_turn = self.begin_prompt_turn(provider, &target, &prompt)?;
        let mut observed_updates = Vec::new();
        let context = PromptTurnContext {
            provider,
            target: &target,
            turn_id: &prompt_turn.turn_id,
            prompt: &prompt,
        };
        let run = self.run_provider_prompt_turn(context, &mut observed_updates)?;
        let result = match run.result {
            Ok(result) => result,
            Err(error) => {
                self.replace_prompt_turn_from_updates(PromptTurnProjection {
                    context,
                    updates: &observed_updates,
                    status: TranscriptItemStatus::Failed,
                    stop_reason: None,
                })?;
                return Err(error);
            }
        };
        append_snapshot_updates_if_missing(
            &mut observed_updates,
            &run.snapshot,
            &target.key.session_id,
        );
        let lifecycle = prompt_lifecycle(&run.snapshot, &target.key.session_id);
        self.replace_prompt_turn_from_updates(PromptTurnProjection {
            context,
            updates: &observed_updates,
            status: prompt_status(lifecycle),
            stop_reason: lifecycle.and_then(|value| value.stop_reason.as_deref()),
        })?;
        Ok(ConsumerResponse::success_without_snapshot(id, result))
    }

    fn session_prompt_target(&self, params: &Value) -> Result<SessionPromptTarget> {
        let open_session_id = string_param("session/prompt", params, "openSessionId")?;
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        let key = self
            .local_store
            .open_session_key("session/prompt", &open_session_id)?;
        Ok(SessionPromptTarget {
            open_session_id,
            key,
        })
    }

    fn begin_prompt_turn(
        &mut self,
        provider: ProviderId,
        target: &SessionPromptTarget,
        prompt: &[Value],
    ) -> Result<PromptTurnMutation> {
        let mutation = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .begin_prompt_turn(&target.open_session_id, prompt)?
        };
        self.emit_timeline_mutation(TimelineMutationEvent {
            provider,
            session_id: &target.key.session_id,
            open_session_id: &mutation.open_session_id,
            revision: mutation.revision,
            items: &mutation.items,
        });
        Ok(mutation)
    }

    fn run_provider_prompt_turn(
        &mut self,
        context: PromptTurnContext<'_>,
        observed_updates: &mut Vec<TranscriptUpdateSnapshot>,
    ) -> Result<ProviderPromptRun> {
        let mut projection_error = None;
        let mut provider_port = self.take_provider(context.provider)?;
        let result = provider_port.session_prompt(
            context.target.key.session_id.clone(),
            context.prompt.to_vec(),
            &mut |update| {
                observed_updates.push(update);
                if projection_error.is_none() {
                    let projection = PromptTurnProjection {
                        context,
                        updates: observed_updates,
                        status: TranscriptItemStatus::Streaming,
                        stop_reason: None,
                    };
                    if let Err(error) = self.replace_prompt_turn_from_updates(projection) {
                        projection_error = Some(error);
                    }
                }
            },
        );
        let snapshot = provider_port.snapshot();
        self.providers.insert(context.provider, provider_port);
        if let Some(error) = projection_error {
            return Err(error);
        }
        Ok(ProviderPromptRun { result, snapshot })
    }

    fn replace_prompt_turn_from_updates(
        &mut self,
        projection: PromptTurnProjection<'_>,
    ) -> Result<()> {
        let mutation = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .replace_prompt_turn_updates(PromptTurnReplace {
                    open_session_id: &projection.context.target.open_session_id,
                    turn_id: projection.context.turn_id,
                    prompt: projection.context.prompt,
                    updates: projection.updates,
                    status: projection.status,
                    stop_reason: projection.stop_reason,
                })?
        };
        self.emit_timeline_mutation(TimelineMutationEvent {
            provider: projection.context.provider,
            session_id: &projection.context.target.key.session_id,
            open_session_id: &mutation.open_session_id,
            revision: mutation.revision,
            items: &mutation.items,
        });
        self.apply_prompt_session_info_updates(projection.context.target, projection.updates)
    }

    fn emit_timeline_mutation(&mut self, event: TimelineMutationEvent<'_>) {
        self.event_buffer.emit(
            event.provider,
            RuntimeEventKind::SessionTimelineChanged,
            Some(event.session_id.to_owned()),
            json!({
                "openSessionId": event.open_session_id,
                "revision": event.revision,
                "items": event.items
            }),
        );
    }

    fn apply_prompt_session_info_updates(
        &mut self,
        target: &SessionPromptTarget,
        updates: &[acp_core::TranscriptUpdateSnapshot],
    ) -> Result<()> {
        for update in updates {
            let revision = {
                let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
                self.local_store
                    .apply_session_info_update(&target.key, &update.update)?
            };
            if let Some(revision) = revision {
                self.event_buffer.emit(
                    target.key.provider,
                    RuntimeEventKind::SessionsIndexChanged,
                    None,
                    json!({ "revision": revision }),
                );
            }
        }
        Ok(())
    }

    fn append_failed_prompt_turn(
        &mut self,
        provider: ProviderId,
        target: &SessionPromptTarget,
        prompt: &[Value],
    ) -> Result<()> {
        let mutation = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .append_prompt_turn_updates(PromptTurnAppend {
                    open_session_id: &target.open_session_id,
                    prompt,
                    updates: &[],
                    status: TranscriptItemStatus::Failed,
                    stop_reason: None,
                })?
        };
        self.emit_timeline_mutation(TimelineMutationEvent {
            provider,
            session_id: &target.key.session_id,
            open_session_id: &mutation.open_session_id,
            revision: mutation.revision,
            items: &mutation.items,
        });
        Ok(())
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
        }
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .remove(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    fn ensure_provider_session_loaded(&mut self, key: &OpenSessionKey) -> Result<()> {
        if self.loaded_provider_sessions.contains(key) {
            return Ok(());
        }
        let cwd = PathBuf::from(&key.cwd);
        let result = {
            let provider_port = self.provider(key.provider)?;
            provider_port.session_load(key.session_id.clone(), cwd)
        };
        result?;
        self.loaded_provider_sessions.insert(key.clone());
        Ok(())
    }
}

fn append_snapshot_updates_if_missing(
    observed_updates: &mut Vec<TranscriptUpdateSnapshot>,
    snapshot: &ProviderSnapshot,
    session_id: &str,
) {
    if observed_updates.is_empty()
        && let Some(lifecycle) = prompt_lifecycle(snapshot, session_id)
    {
        observed_updates.extend(lifecycle.updates.clone());
    }
}

pub(crate) fn store_lock_error<T>(error: std::sync::PoisonError<T>) -> RuntimeError {
    RuntimeError::Provider(format!("local store lock poisoned: {error}"))
}
