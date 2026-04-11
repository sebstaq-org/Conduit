//! Provider manager and command dispatcher.

use crate::command::{
    ConsumerCommand, ConsumerResponse, session_id_from_value, session_ids_from_list,
};
use crate::error::{
    RuntimeError, optional_string_param, optional_u64_param, path_param, string_param,
};
use crate::event::{EventBuffer, RuntimeEvent, RuntimeEventKind};
use crate::session_groups::{
    SessionGroupsQuery, grouped_view, next_cursor, providers_from_target, rows_from_session_list,
};
use crate::session_history::{OpenSessionKey, SessionHistoryStore};
use crate::{AppServiceFactory, ProviderFactory, ProviderPort, Result};
use acp_core::ConnectionState;
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::str::FromStr;

/// Consumer API runtime manager keyed by provider.
pub struct ServiceRuntime<F = AppServiceFactory> {
    event_buffer: EventBuffer,
    factory: F,
    providers: HashMap<ProviderId, Box<dyn ProviderPort>>,
    session_history: SessionHistoryStore,
}

impl ServiceRuntime<AppServiceFactory> {
    /// Creates a consumer runtime backed by real provider services.
    #[must_use]
    pub fn new() -> Self {
        Self::with_factory(AppServiceFactory::default())
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
            session_history: SessionHistoryStore::new(),
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
        let mut rows = Vec::new();
        for provider in providers {
            rows.extend(self.grouped_rows_for_provider(provider, &query)?);
        }
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            grouped_view(rows)?,
        ))
    }

    fn grouped_rows_for_provider(
        &mut self,
        provider: ProviderId,
        query: &SessionGroupsQuery,
    ) -> Result<Vec<crate::session_groups::SessionRowWithCwd>> {
        let cwd_filters = query.cwd_filters();
        if cwd_filters.is_empty() {
            let provider_port = self.provider(provider)?;
            return paginated_grouped_rows(provider_port.as_mut(), provider, None, query);
        }
        let mut rows = Vec::new();
        for cwd in cwd_filters {
            let provider_port = self.provider(provider)?;
            rows.extend(paginated_grouped_rows(
                provider_port.as_mut(),
                provider,
                Some(PathBuf::from(cwd)),
                query,
            )?);
        }
        Ok(rows)
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
        let cwd = path_param("session/open", params, "cwd")?;
        let limit = optional_u64_param("session/open", params, "limit")?;
        let key = OpenSessionKey {
            provider,
            session_id: session_id.clone(),
            cwd: cwd.display().to_string(),
        };
        if let Some(open_session_id) = self.session_history.existing_open_session_id(&key) {
            let result =
                self.session_history
                    .window("session/open", open_session_id, None, limit)?;
            return Ok(ConsumerResponse::success_without_snapshot(id, result));
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
        let result = self.session_history.open(key, updates, limit)?;
        Ok(ConsumerResponse::success(id, result, snapshot))
    }

    fn session_history(
        &mut self,
        id: String,
        provider: ProviderId,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let open_session_id = string_param("session/history", params, "openSessionId")?;
        if self.session_history.provider_for(&open_session_id) != Some(provider) {
            return Err(RuntimeError::InvalidParameter {
                command: "session/history",
                parameter: "openSessionId",
                message: "open session belongs to another provider or is unknown",
            });
        }
        let cursor = optional_string_param("session/history", params, "cursor")?;
        let limit = optional_u64_param("session/history", params, "limit")?;
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            self.session_history
                .window("session/history", open_session_id, cursor, limit)?,
        ))
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
}

fn parse_provider(value: &str) -> Result<ProviderId> {
    ProviderId::from_str(value).map_err(|message| RuntimeError::UnknownProvider {
        provider: value.to_owned(),
        message,
    })
}

fn paginated_grouped_rows(
    provider_port: &mut dyn ProviderPort,
    provider: ProviderId,
    cwd: Option<PathBuf>,
    query: &SessionGroupsQuery,
) -> Result<Vec<crate::session_groups::SessionRowWithCwd>> {
    let mut rows = Vec::new();
    let mut cursor = None;
    let mut seen_cursors = HashSet::new();
    loop {
        let result = provider_port.session_list(cwd.clone(), cursor.clone())?;
        rows.extend(rows_from_session_list(provider, &result, query)?);
        cursor = next_cursor(&result)?;
        let Some(next_cursor) = &cursor else {
            break;
        };
        if !seen_cursors.insert(next_cursor.clone()) {
            return Err(RuntimeError::Provider(
                "session/list returned a repeated nextCursor".to_owned(),
            ));
        }
    }
    Ok(rows)
}

fn loaded_transcript_updates(
    snapshot: &acp_core::ProviderSnapshot,
    session_id: &str,
) -> Vec<Value> {
    snapshot
        .loaded_transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .map(|transcript| {
            transcript
                .updates
                .iter()
                .map(|update| {
                    json!({
                        "replay_index": update.index,
                        "session_update": update.variant,
                        "update": update.update,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn loaded_transcript_snapshot_updates<'a>(
    snapshot: &'a acp_core::ProviderSnapshot,
    session_id: &str,
) -> &'a [acp_core::TranscriptUpdateSnapshot] {
    snapshot
        .loaded_transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .map(|transcript| transcript.updates.as_slice())
        .unwrap_or_default()
}
