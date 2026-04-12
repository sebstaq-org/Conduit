//! Provider manager and command dispatcher.

use crate::command::{
    ConsumerCommand, ConsumerResponse, session_id_from_value, session_ids_from_list,
};
use crate::error::{
    RuntimeError, optional_string_param, optional_u64_param, path_param, string_param,
};
use crate::event::{EventBuffer, RuntimeEvent, RuntimeEventKind};
use crate::manager_helpers::{
    absolute_normalized_cwd, content_blocks_param, current_epoch,
    loaded_transcript_snapshot_updates, loaded_transcript_updates, paginated_index_entries,
    parse_provider, prompt_lifecycle, prompt_status,
};
use crate::session_groups::{SessionGroupsQuery, grouped_view, providers_from_target};
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_core::ConnectionState;
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use session_store::{
    HistoryLimit, LocalStore, OpenSessionKey, PromptTurnAppend, TranscriptItemStatus,
};
use std::collections::HashMap;

const SESSION_INDEX_REFRESH_INTERVAL_SECONDS: u64 = 30;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    event_buffer: EventBuffer,
    factory: F,
    session_index_refreshes: HashMap<ProviderId, u64>,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
    local_store: LocalStore,
}

struct SessionPromptTarget {
    open_session_id: String,
    key: OpenSessionKey,
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
        Self {
            event_buffer: EventBuffer::new(),
            factory,
            session_index_refreshes: HashMap::new(),
            providers: HashMap::new(),
            local_store,
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
        let provider = parse_provider(&command.provider)?;
        match command.command.as_str() {
            "initialize" => self.initialize(command.id, provider),
            "session/new" => self.session_new(command.id, provider, &command.params),
            "session/list" => self.session_list(command.id, provider),
            "session/load" => self.session_load(command.id, provider, &command.params),
            "session/open" => self.session_open(command.id, provider, &command.params),
            "session/history" => self.session_history(command.id, provider, &command.params),
            "session/prompt" => self.session_prompt(command.id, provider, &command.params),
            "session/cancel" => self.session_cancel(command.id, provider, &command.params),
            "snapshot/get" => self.provider_snapshot(command.id, provider),
            "provider/disconnect" => self.provider_disconnect(command.id, provider),
            "events/subscribe" => self.events_subscribe(command.id, provider, &command.params),
            _ => Err(RuntimeError::UnsupportedCommand(command.command)),
        }
    }

    fn sessions_grouped(
        &mut self,
        id: String,
        provider_target: &str,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let query = SessionGroupsQuery::from_params(params)?;
        let providers = providers_from_target(provider_target)?;
        let is_refreshing = providers
            .iter()
            .any(|provider| self.session_index_refresh_due(*provider));
        let snapshot = self.local_store.session_index(&providers)?;
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            grouped_view(snapshot, &query, is_refreshing)?,
        ))
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
            let result = provider_port.session_list(None, None)?;
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
        for update in loaded_transcript_updates(&snapshot, &session_id) {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionReplayUpdate,
                Some(session_id.clone()),
                update,
            );
        }
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
        if let Some(result) = self.local_store.cached_session(&key, limit)? {
            return Ok(ConsumerResponse::success_without_snapshot(
                id,
                to_value(result)?,
            ));
        }
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let _result = provider_port.session_load(session_id.clone(), cwd)?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        for update in loaded_transcript_updates(&snapshot, &session_id) {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionReplayUpdate,
                Some(session_id.clone()),
                update,
            );
        }
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::SessionObserved,
            Some(session_id.clone()),
            json!({ "observed_via": "session/open" }),
        );
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        let updates = loaded_transcript_snapshot_updates(&snapshot, &session_id);
        let result = to_value(self.local_store.open_session(key, updates, limit)?)?;
        Ok(ConsumerResponse::success_without_snapshot(id, result))
    }

    fn session_history(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let open_session_id = string_param("session/history", params, "openSessionId")?;
        let limit = HistoryLimit::new(
            "session/history",
            optional_u64_param("session/history", params, "limit")?,
        )?;
        if self.local_store.provider_for(&open_session_id)? != Some(provider) {
            return Err(RuntimeError::InvalidParameter {
                command: "session/history",
                parameter: "openSessionId",
                message: "open session belongs to another provider or is unknown",
            });
        }
        let cursor = optional_string_param("session/history", params, "cursor")?;
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(
                self.local_store
                    .history_window(&open_session_id, cursor, limit)?,
            )?,
        ))
    }

    fn session_prompt(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let target = self.session_prompt_target(provider, params)?;
        let prompt = content_blocks_param("session/prompt", params, "prompt")?;
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::PromptStarted,
            Some(target.key.session_id.clone()),
            json!({ "prompt": prompt.clone() }),
        );
        let mut observed_updates = Vec::new();
        let (result, snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            let result = provider_port.session_prompt(
                target.key.session_id.clone(),
                prompt.clone(),
                &mut |update| {
                    observed_updates.push(update);
                },
            );
            (result, provider_port.snapshot(), provider_port.raw_events())
        };
        let result = match result {
            Ok(result) => result,
            Err(error) => {
                self.append_failed_prompt_turn(provider, &target, &prompt)?;
                self.event_buffer
                    .capture_raw_events(provider, &raw_events)?;
                return Err(error);
            }
        };
        if observed_updates.is_empty()
            && let Some(lifecycle) = prompt_lifecycle(&snapshot, &target.key.session_id)
        {
            observed_updates.extend(lifecycle.updates.clone());
        }
        for update in &observed_updates {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::PromptUpdateObserved,
                Some(target.key.session_id.clone()),
                json!({
                    "update_index": update.index,
                    "session_update": update.variant,
                    "update": update.update
                }),
            );
        }
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::PromptCompleted,
            Some(target.key.session_id.clone()),
            result.clone(),
        );
        self.append_prompt_turn_from_updates(&target, &prompt, &snapshot, &observed_updates)?;
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_prompt_target(
        &self,
        provider: ProviderId,
        params: &Value,
    ) -> Result<SessionPromptTarget> {
        let open_session_id = string_param("session/prompt", params, "openSessionId")?;
        let key = self
            .local_store
            .open_session_key("session/prompt", &open_session_id)?;
        if key.provider != provider {
            return Err(RuntimeError::InvalidParameter {
                command: "session/prompt",
                parameter: "openSessionId",
                message: "open session belongs to another provider",
            });
        }
        Ok(SessionPromptTarget {
            open_session_id,
            key,
        })
    }

    fn append_prompt_turn_from_updates(
        &mut self,
        target: &SessionPromptTarget,
        prompt: &[Value],
        snapshot: &acp_core::ProviderSnapshot,
        updates: &[acp_core::TranscriptUpdateSnapshot],
    ) -> Result<()> {
        let lifecycle = prompt_lifecycle(snapshot, &target.key.session_id);
        let mutation = self
            .local_store
            .append_prompt_turn_updates(PromptTurnAppend {
                open_session_id: &target.open_session_id,
                prompt,
                updates,
                status: prompt_status(lifecycle),
                stop_reason: lifecycle.and_then(|value| value.stop_reason.as_deref()),
            })?;
        self.event_buffer.emit(
            snapshot.provider,
            RuntimeEventKind::SessionTimelineChanged,
            Some(target.key.session_id.clone()),
            json!({
                "openSessionId": mutation.open_session_id,
                "revision": mutation.revision
            }),
        );
        for update in updates {
            if let Some(revision) = self
                .local_store
                .apply_session_info_update(&target.key, &update.update)?
            {
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
        let mutation = self
            .local_store
            .append_prompt_turn_updates(PromptTurnAppend {
                open_session_id: &target.open_session_id,
                prompt,
                updates: &[],
                status: TranscriptItemStatus::Failed,
                stop_reason: None,
            })?;
        self.event_buffer.emit(
            provider,
            RuntimeEventKind::SessionTimelineChanged,
            Some(target.key.session_id.clone()),
            json!({
                "openSessionId": mutation.open_session_id,
                "revision": mutation.revision
            }),
        );
        Ok(())
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
        self.providers.remove(&provider);
        Ok(ConsumerResponse::success(id, json!({}), snapshot))
    }

    fn events_subscribe(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let after_sequence =
            optional_u64_param("events/subscribe", params, "after_sequence")?.unwrap_or(0);
        let (snapshot, raw_events) = {
            let provider_port = self.provider(provider)?;
            (provider_port.snapshot(), provider_port.raw_events())
        };
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        let result = json!({
            "events": self.event_buffer.events_after(after_sequence),
            "next_sequence": self.event_buffer.latest_sequence(),
            "raw_wire_events": raw_events,
        });
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn provider(&mut self, provider: ProviderId) -> Result<&mut Box<dyn ProviderPort>> {
        if self
            .providers
            .get(&provider)
            .is_some_and(|entry| entry.snapshot().connection_state == ConnectionState::Disconnected)
        {
            self.providers.remove(&provider);
        }
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .get_mut(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    fn session_index_refresh_due(&self, provider: ProviderId) -> bool {
        self.session_index_refreshes
            .get(&provider)
            .is_none_or(|last| {
                current_epoch()
                    .saturating_sub(*last)
                    .ge(&SESSION_INDEX_REFRESH_INTERVAL_SECONDS)
            })
    }

    fn refresh_session_index_provider(&mut self, provider: ProviderId) -> Result<()> {
        let (entries, raw_events) = {
            let provider_port = self.provider(provider)?;
            let entries = paginated_index_entries(provider_port.as_mut(), provider)?;
            (entries, provider_port.raw_events())
        };
        self.session_index_refreshes
            .insert(provider, current_epoch());
        if let Some(revision) = self
            .local_store
            .replace_session_index_provider(provider, &entries)?
        {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionsIndexChanged,
                None,
                json!({ "revision": revision }),
            );
        }
        self.event_buffer
            .capture_raw_events(provider, &raw_events)?;
        Ok(())
    }
}
