use super::ServiceRuntime;
use crate::command::ConsumerResponse;
use crate::error::string_param;
use crate::event::RuntimeEventKind;
use crate::manager_helpers::{content_blocks_param, prompt_lifecycle, prompt_status};
use crate::manager_response::{append_snapshot_updates_if_missing, store_lock_error};
use crate::{ProviderFactory, Result};
use acp_core::{ProviderSnapshot, TranscriptUpdateSnapshot};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use session_store::{
    OpenSessionKey, PromptTurnAppend, PromptTurnMutation, PromptTurnReplace, TranscriptItem,
    TranscriptItemStatus,
};

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
    items: &'a [TranscriptItem],
}

impl<F> ServiceRuntime<F>
where
    F: ProviderFactory,
{
    pub(super) fn session_prompt(
        &mut self,
        id: String,
        params: &Value,
    ) -> Result<ConsumerResponse> {
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
        let mut provider_port = self.take_initialized_provider(context.provider)?;
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
        let mut state_changed = false;
        for update in updates {
            if let Some(state) = self.session_states.get_mut(&target.key) {
                state_changed |= apply_projected_session_state_update(state, &update.update);
            }
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
        if state_changed && let Some(state) = self.session_states.get(&target.key).cloned() {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .set_open_session_state(&target.key, &state)?;
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
}

fn apply_projected_session_state_update(state: &mut Value, update: &Value) -> bool {
    let Some(session_update) = update.get("sessionUpdate").and_then(Value::as_str) else {
        return false;
    };
    let Some(map) = state.as_object_mut() else {
        return false;
    };
    let mut changed = false;
    if session_update == "config_option_update"
        && let Some(config_options) = update.get("configOptions")
        && map.get("configOptions") != Some(config_options)
    {
        map.insert("configOptions".to_owned(), config_options.clone());
        changed = true;
    }
    if session_update == "current_mode_update"
        && let Some(current_mode_id) = update.get("currentModeId")
        && map.get("currentModeId") != Some(current_mode_id)
    {
        map.insert("currentModeId".to_owned(), current_mode_id.clone());
        changed = true;
    }
    changed
}
