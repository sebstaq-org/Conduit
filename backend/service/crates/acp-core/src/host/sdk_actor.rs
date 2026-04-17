//! Official ACP SDK actor for one provider connection.

mod internals;

use super::InteractionResponse;
use super::helpers::{identity, session_update_variant, unexpected};
use super::prompt::{prompt_content_blocks, stop_reason_string};
use crate::error::{AcpError, Result};
use crate::snapshot::{
    ConnectionState, LiveSessionSnapshot, LoadedTranscriptSnapshot, PromptLifecycleSnapshot,
    PromptLifecycleState, ProviderSnapshot, TranscriptUpdateSnapshot,
};
use crate::{
    ConduitInteractionOption, ConduitInteractionRequestData, ConduitInteractionRequestInput,
    ConduitInteractionResolutionData, ConduitInteractionResolutionStatus,
};
use acp_discovery::{LauncherCommand, ProcessEnvironment, ProviderDiscovery, ProviderId};
use agent_client_protocol::{self as acp, Agent as _};
use internals::{
    apply_process_environment, child_has_exited, disconnected, sdk_error, send_reply, to_values,
};
use serde_json::{Value, json, to_value};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::sync::oneshot;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

pub(super) enum HostCommand {
    Snapshot {
        reply: Sender<Result<ProviderSnapshot>>,
    },
    Disconnect {
        reply: Sender<Result<()>>,
    },
    NewSession {
        cwd: PathBuf,
        reply: Sender<Result<acp::NewSessionResponse>>,
    },
    ListSessions {
        cwd: Option<PathBuf>,
        cursor: Option<String>,
        reply: Sender<Result<acp::ListSessionsResponse>>,
    },
    LoadSession {
        session_id: acp::SessionId,
        cwd: PathBuf,
        reply: Sender<Result<acp::LoadSessionResponse>>,
    },
    PromptContent {
        session_id: acp::SessionId,
        prompt: Vec<Value>,
        cancel_after: Option<Duration>,
        updates: Sender<TranscriptUpdateSnapshot>,
        reply: Sender<Result<acp::PromptResponse>>,
    },
    CancelPrompt {
        session_id: acp::SessionId,
        reply: Sender<Result<()>>,
    },
    SetSessionConfigOption {
        session_id: acp::SessionId,
        config_id: String,
        value: String,
        reply: Sender<Result<acp::SetSessionConfigOptionResponse>>,
    },
}

impl HostCommand {
    pub(super) fn snapshot(reply: Sender<Result<ProviderSnapshot>>) -> Self {
        Self::Snapshot { reply }
    }

    pub(super) fn disconnect(reply: Sender<Result<()>>) -> Self {
        Self::Disconnect { reply }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct InteractionKey {
    provider: ProviderId,
    session_id: String,
    interaction_id: String,
}

struct PendingInteraction {
    response_tx: oneshot::Sender<acp::RequestPermissionResponse>,
}

#[derive(Default)]
struct InteractionRegistry {
    pending: HashMap<InteractionKey, PendingInteraction>,
    resolved: HashSet<InteractionKey>,
}

static INTERACTION_REGISTRY: LazyLock<Mutex<InteractionRegistry>> =
    LazyLock::new(|| Mutex::new(InteractionRegistry::default()));

pub(super) fn respond_interaction(
    provider: ProviderId,
    session_id: &str,
    interaction_id: &str,
    response: InteractionResponse,
) -> Result<()> {
    let key = InteractionKey {
        provider,
        session_id: session_id.to_owned(),
        interaction_id: interaction_id.to_owned(),
    };
    let pending = {
        let mut registry = INTERACTION_REGISTRY
            .lock()
            .map_err(|error| unexpected(provider, error.to_string()))?;
        if let Some(pending) = registry.pending.remove(&key) {
            registry.resolved.insert(key.clone());
            pending
        } else if registry.resolved.contains(&key) {
            return Err(AcpError::ResolvedInteraction {
                provider,
                session_id: session_id.to_owned(),
                interaction_id: interaction_id.to_owned(),
            });
        } else {
            return Err(AcpError::UnknownInteraction {
                provider,
                session_id: session_id.to_owned(),
                interaction_id: interaction_id.to_owned(),
            });
        }
    };
    let payload = permission_response_from_interaction(provider, interaction_id, response)?;
    pending
        .response_tx
        .send(payload)
        .map_err(|_error| AcpError::ResolvedInteraction {
            provider,
            session_id: session_id.to_owned(),
            interaction_id: interaction_id.to_owned(),
        })?;
    Ok(())
}

fn permission_response_from_interaction(
    provider: ProviderId,
    interaction_id: &str,
    response: InteractionResponse,
) -> Result<acp::RequestPermissionResponse> {
    match response {
        InteractionResponse::Selected { option_id } => {
            if option_id.trim().is_empty() {
                return Err(invalid_interaction_response(
                    provider,
                    interaction_id,
                    "selected option id must be non-empty",
                ));
            }
            Ok(acp::RequestPermissionResponse::new(
                acp::RequestPermissionOutcome::Selected(acp::SelectedPermissionOutcome::new(
                    option_id,
                )),
            ))
        }
        InteractionResponse::AnswerOther {
            option_id,
            question_id,
            text,
        } => {
            permission_response_answer_other(provider, interaction_id, option_id, question_id, text)
        }
        InteractionResponse::Cancelled => Ok(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        )),
    }
}

fn permission_response_answer_other(
    provider: ProviderId,
    interaction_id: &str,
    option_id: String,
    question_id: String,
    text: String,
) -> Result<acp::RequestPermissionResponse> {
    if option_id.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other option id must be non-empty",
        ));
    }
    if question_id.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other question id must be non-empty",
        ));
    }
    if text.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other text must be non-empty",
        ));
    }
    let meta = serde_json::Map::from_iter([(
        "request_user_input_response".to_owned(),
        json!({
            "answers": {
                question_id: {
                    "answers": [text]
                }
            }
        }),
    )]);
    Ok(acp::RequestPermissionResponse::new(
        acp::RequestPermissionOutcome::Selected(
            acp::SelectedPermissionOutcome::new(option_id).meta(meta),
        ),
    ))
}

fn invalid_interaction_response(
    provider: ProviderId,
    interaction_id: &str,
    message: &'static str,
) -> AcpError {
    AcpError::InvalidInteractionResponse {
        provider,
        interaction_id: interaction_id.to_owned(),
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answer_other_response_includes_request_user_input_meta()
    -> std::result::Result<(), Box<dyn std::error::Error>> {
        let response = permission_response_from_interaction(
            ProviderId::Codex,
            "interaction-1",
            InteractionResponse::AnswerOther {
                option_id: "answer-other".to_owned(),
                question_id: "plan_target".to_owned(),
                text: "custom choice".to_owned(),
            },
        )?;
        let payload = serde_json::to_value(response)?;
        if payload
            .pointer("/outcome/_meta/request_user_input_response/answers/plan_target/answers/0")
            .and_then(Value::as_str)
            == Some("custom choice")
        {
            return Ok(());
        }
        Err(format!("missing answer-other meta payload: {payload}").into())
    }

    #[test]
    fn selected_response_requires_non_empty_option_id() {
        let result = permission_response_from_interaction(
            ProviderId::Codex,
            "interaction-1",
            InteractionResponse::Selected {
                option_id: " ".to_owned(),
            },
        );
        assert!(
            matches!(result, Err(AcpError::InvalidInteractionResponse { .. })),
            "expected invalid interaction response, got {result:?}"
        );
    }
}

struct SdkHostActor {
    auth_methods: Vec<Value>,
    capabilities: Value,
    child: Option<tokio::process::Child>,
    connection: Option<acp::ClientSideConnection>,
    discovery: ProviderDiscovery,
    last_prompt: Option<PromptLifecycleSnapshot>,
    loaded_transcripts: BTreeMap<String, LoadedTranscriptSnapshot>,
    live_sessions: BTreeMap<String, LiveSessionSnapshot>,
    provider: ProviderId,
    updates: Arc<Mutex<PromptUpdateState>>,
}

impl SdkHostActor {
    async fn connect(
        provider: ProviderId,
        discovery: ProviderDiscovery,
        launcher: LauncherCommand,
        environment: ProcessEnvironment,
    ) -> Result<Self> {
        let updates = Arc::new(Mutex::new(PromptUpdateState::default()));
        let (connection, child) =
            spawn_sdk_connection(provider, &launcher, &environment, &updates)?;
        let initialize = connection
            .initialize(acp::InitializeRequest::new(acp::ProtocolVersion::V1))
            .await
            .map_err(|source| sdk_error(provider, "initialize", source))?;
        Ok(Self {
            auth_methods: to_values(provider, initialize.auth_methods, "authMethods")?,
            capabilities: to_value(initialize.agent_capabilities)
                .map_err(|error| unexpected(provider, error.to_string()))?,
            child: Some(child),
            connection: Some(connection),
            discovery,
            last_prompt: None,
            loaded_transcripts: BTreeMap::new(),
            live_sessions: BTreeMap::new(),
            provider,
            updates,
        })
    }

    async fn run(&mut self, mut commands: UnboundedReceiver<HostCommand>) {
        while let Some(command) = commands.recv().await {
            self.handle_command(command).await;
        }
        self.disconnect().await;
    }

    async fn handle_command(&mut self, command: HostCommand) {
        match command {
            HostCommand::Snapshot { reply } => send_reply(reply, Ok(self.snapshot())),
            HostCommand::Disconnect { reply } => {
                self.disconnect().await;
                send_reply(reply, Ok(()));
            }
            HostCommand::NewSession { cwd, reply } => {
                let result = self.new_session(cwd).await;
                send_reply(reply, result);
            }
            HostCommand::ListSessions { cwd, cursor, reply } => {
                let result = self.list_sessions(cwd, cursor).await;
                send_reply(reply, result);
            }
            HostCommand::LoadSession {
                session_id,
                cwd,
                reply,
            } => {
                let result = self.load_session(session_id, cwd).await;
                send_reply(reply, result);
            }
            HostCommand::PromptContent {
                session_id,
                prompt,
                cancel_after,
                updates,
                reply,
            } => {
                let result = self
                    .prompt_content(session_id, prompt, cancel_after, updates)
                    .await;
                send_reply(reply, result);
            }
            HostCommand::CancelPrompt { session_id, reply } => {
                let result = self.cancel_prompt(session_id).await;
                send_reply(reply, result);
            }
            HostCommand::SetSessionConfigOption {
                session_id,
                config_id,
                value,
                reply,
            } => {
                let result = self
                    .set_session_config_option(session_id, config_id, value)
                    .await;
                send_reply(reply, result);
            }
        }
    }

    fn snapshot(&mut self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: self.connection_state(),
            discovery: self.discovery.clone(),
            capabilities: self.capabilities.clone(),
            auth_methods: self.auth_methods.clone(),
            live_sessions: self.live_sessions.values().cloned().collect(),
            last_prompt: self.last_prompt.clone(),
            loaded_transcripts: self.loaded_transcripts.values().cloned().collect(),
        }
    }

    async fn disconnect(&mut self) {
        cancel_pending_interactions_for_provider(self.provider);
        self.connection = None;
        if let Some(mut child) = self.child.take() {
            let _result = child.start_kill();
            let _status = child.wait().await;
        }
    }

    async fn new_session(&mut self, cwd: PathBuf) -> Result<acp::NewSessionResponse> {
        let cwd_text = cwd.display().to_string();
        let response = self
            .connection()?
            .new_session(acp::NewSessionRequest::new(cwd))
            .await
            .map_err(|source| sdk_error(self.provider, "session/new", source))?;
        self.live_sessions.insert(
            response.session_id.to_string(),
            LiveSessionSnapshot {
                identity: identity(self.provider, &response.session_id),
                cwd: cwd_text,
                title: None,
                observed_via: "new".to_owned(),
            },
        );
        Ok(response)
    }

    async fn list_sessions(
        &mut self,
        cwd: Option<PathBuf>,
        cursor: Option<String>,
    ) -> Result<acp::ListSessionsResponse> {
        let request = acp::ListSessionsRequest::new().cwd(cwd).cursor(cursor);
        let response = self
            .connection()?
            .list_sessions(request)
            .await
            .map_err(|source| sdk_error(self.provider, "session/list", source))?;
        for session in &response.sessions {
            self.live_sessions.insert(
                session.session_id.to_string(),
                LiveSessionSnapshot {
                    identity: identity(self.provider, &session.session_id),
                    cwd: session.cwd.display().to_string(),
                    title: session.title.clone(),
                    observed_via: "list".to_owned(),
                },
            );
        }
        Ok(response)
    }

    async fn load_session(
        &mut self,
        session_id: acp::SessionId,
        cwd: PathBuf,
    ) -> Result<acp::LoadSessionResponse> {
        update_session_tracker(
            &self.updates,
            Some(session_id.to_string()),
            0,
            None,
            self.provider,
        )?;
        let response = self
            .connection()?
            .load_session(acp::LoadSessionRequest::new(
                session_id.clone(),
                cwd.clone(),
            ))
            .await;
        let replay_updates = take_session_updates(&self.updates, self.provider)?;
        let response =
            response.map_err(|source| sdk_error(self.provider, "session/load", source))?;
        let title = self
            .live_sessions
            .get(&session_id.to_string())
            .and_then(|entry| entry.title.clone());
        self.live_sessions.insert(
            session_id.to_string(),
            LiveSessionSnapshot {
                identity: identity(self.provider, &session_id),
                cwd: cwd.display().to_string(),
                title,
                observed_via: "load".to_owned(),
            },
        );
        self.loaded_transcripts.insert(
            session_id.to_string(),
            LoadedTranscriptSnapshot {
                identity: identity(self.provider, &session_id),
                raw_update_count: replay_updates.raw_update_count,
                updates: replay_updates.updates,
            },
        );
        Ok(response)
    }

    async fn set_session_config_option(
        &mut self,
        session_id: acp::SessionId,
        config_id: String,
        value: String,
    ) -> Result<acp::SetSessionConfigOptionResponse> {
        self.connection()?
            .set_session_config_option(acp::SetSessionConfigOptionRequest::new(
                session_id, config_id, value,
            ))
            .await
            .map_err(|source| sdk_error(self.provider, "session/set_config_option", source))
    }

    async fn prompt_content(
        &mut self,
        session_id: acp::SessionId,
        prompt: Vec<Value>,
        cancel_after: Option<Duration>,
        updates: Sender<TranscriptUpdateSnapshot>,
    ) -> Result<acp::PromptResponse> {
        self.ensure_known_session(&session_id)?;
        let prompt = prompt_content_blocks(self.provider, prompt)?;
        self.start_prompt(&session_id, updates)?;
        let response = self
            .prompt_with_optional_cancel(&session_id, prompt, cancel_after)
            .await?;
        self.finish_prompt(&session_id, &response)?;
        Ok(response)
    }

    async fn prompt_with_optional_cancel(
        &self,
        session_id: &acp::SessionId,
        prompt: Vec<acp::ContentBlock>,
        cancel_after: Option<Duration>,
    ) -> Result<acp::PromptResponse> {
        let prompt = self
            .connection()?
            .prompt(acp::PromptRequest::new(session_id.clone(), prompt));
        tokio::pin!(prompt);
        if let Some(after) = cancel_after {
            return self.cancel_during_prompt(session_id, after, prompt).await;
        }
        prompt
            .await
            .map_err(|source| sdk_error(self.provider, "session/prompt", source))
    }

    async fn cancel_prompt(&self, session_id: acp::SessionId) -> Result<()> {
        cancel_pending_interactions_for_session(self.provider, &session_id.to_string());
        self.connection()?
            .cancel(acp::CancelNotification::new(session_id))
            .await
            .map_err(|source| sdk_error(self.provider, "session/cancel", source))
    }

    async fn cancel_during_prompt(
        &self,
        session_id: &acp::SessionId,
        after: Duration,
        mut prompt: std::pin::Pin<
            &mut impl std::future::Future<Output = acp::Result<acp::PromptResponse>>,
        >,
    ) -> Result<acp::PromptResponse> {
        tokio::select! {
            response = &mut prompt => {
                response.map_err(|source| sdk_error(self.provider, "session/prompt", source))
            }
            () = tokio::time::sleep(after) => {
                self.cancel_prompt(session_id.clone()).await?;
                prompt.await.map_err(|source| sdk_error(self.provider, "session/prompt", source))
            }
        }
    }

    fn start_prompt(
        &mut self,
        session_id: &acp::SessionId,
        update_sender: Sender<TranscriptUpdateSnapshot>,
    ) -> Result<()> {
        update_session_tracker(
            &self.updates,
            Some(session_id.to_string()),
            0,
            Some(update_sender),
            self.provider,
        )?;
        self.last_prompt = Some(PromptLifecycleSnapshot {
            identity: identity(self.provider, session_id),
            state: PromptLifecycleState::Running,
            stop_reason: None,
            raw_update_count: 0,
            agent_text_chunks: Vec::new(),
            updates: Vec::new(),
        });
        Ok(())
    }

    fn finish_prompt(
        &mut self,
        session_id: &acp::SessionId,
        response: &acp::PromptResponse,
    ) -> Result<()> {
        let updates = take_session_updates(&self.updates, self.provider)?;
        let stop_reason = stop_reason_string(response);
        let state = if stop_reason.as_deref() == Some("cancelled") {
            PromptLifecycleState::Cancelled
        } else {
            PromptLifecycleState::Completed
        };
        self.last_prompt = Some(PromptLifecycleSnapshot {
            identity: identity(self.provider, session_id),
            state,
            stop_reason,
            raw_update_count: updates.raw_update_count,
            agent_text_chunks: updates.agent_text_chunks,
            updates: updates.updates,
        });
        Ok(())
    }

    fn ensure_known_session(&self, session_id: &acp::SessionId) -> Result<()> {
        if self.live_sessions.contains_key(&session_id.to_string()) {
            return Ok(());
        }
        Err(AcpError::UnknownSession {
            provider: self.provider,
            session_id: session_id.to_string(),
        })
    }

    fn connection(&self) -> Result<&acp::ClientSideConnection> {
        self.connection
            .as_ref()
            .ok_or_else(|| disconnected(self.provider, "official-sdk"))
    }

    fn connection_state(&mut self) -> ConnectionState {
        if self.connection.is_none() {
            return ConnectionState::Disconnected;
        }
        if child_has_exited(&mut self.child) {
            self.connection = None;
            return ConnectionState::Disconnected;
        }
        ConnectionState::Ready
    }
}

include!("sdk_actor_tail.rs");
