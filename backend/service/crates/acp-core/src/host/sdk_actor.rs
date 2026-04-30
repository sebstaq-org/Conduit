//! Official ACP SDK actor for one provider connection.

mod initialize;
mod interaction;
mod internals;

use super::InteractionResponse;
use super::helpers::{identity, session_update_variant, unexpected};
use super::prompt::{prompt_content_blocks, stop_reason_string};
use crate::error::{AcpError, Result};
use crate::initialize::{ProviderInitializeRequest, ProviderInitializeResult};
use crate::snapshot::{
    ConnectionState, LiveSessionSnapshot, LoadedTranscriptSnapshot, PromptLifecycleSnapshot,
    PromptLifecycleState, ProviderSnapshot, TranscriptUpdateSnapshot,
};
use crate::{
    ConduitInteractionOption, ConduitInteractionRequestData, ConduitInteractionRequestInput,
    ConduitInteractionResolutionData, ConduitInteractionResolutionStatus,
};
use acp_discovery::{LauncherCommand, ProcessEnvironment, ProviderDiscovery, ProviderId};
use agent_client_protocol as acp_sdk;
use agent_client_protocol::schema as acp;
use interaction::{
    cancel_pending_interactions_for_provider, cancel_pending_interactions_for_session,
    register_pending_interaction,
};
use internals::{apply_process_environment, child_has_exited, disconnected, sdk_error, send_reply};
use serde_json::{Value, to_value};
use std::collections::{BTreeMap, VecDeque};
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::sync::oneshot;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

type SdkConnection = acp_sdk::ConnectionTo<acp_sdk::Agent>;
type SdkChildStdin = tokio_util::compat::Compat<tokio::process::ChildStdin>;
type SdkChildStdout = tokio_util::compat::Compat<tokio::process::ChildStdout>;
type SdkTransport = acp_sdk::ByteStreams<SdkChildStdin, SdkChildStdout>;

struct ConnectedActor {
    provider: ProviderId,
    discovery: ProviderDiscovery,
    child: tokio::process::Child,
    connection: SdkConnection,
    updates: Arc<Mutex<PromptUpdateState>>,
    commands: UnboundedReceiver<HostCommand>,
}

pub(super) enum HostCommand {
    Initialize {
        request: ProviderInitializeRequest,
        reply: Sender<Result<ProviderInitializeResult>>,
    },
    InitializeResult {
        reply: Sender<Result<Option<ProviderInitializeResult>>>,
    },
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

pub(super) fn respond_interaction(
    provider: ProviderId,
    session_id: &str,
    interaction_id: &str,
    response: InteractionResponse,
) -> Result<()> {
    interaction::respond_interaction(provider, session_id, interaction_id, response)
}

struct SdkHostActor {
    child: Option<tokio::process::Child>,
    connection: Option<SdkConnection>,
    discovery: ProviderDiscovery,
    initialize_result: Option<ProviderInitializeResult>,
    last_prompt: Option<PromptLifecycleSnapshot>,
    loaded_transcripts: BTreeMap<String, LoadedTranscriptSnapshot>,
    live_sessions: BTreeMap<String, LiveSessionSnapshot>,
    provider: ProviderId,
    updates: Arc<Mutex<PromptUpdateState>>,
}

impl SdkHostActor {
    fn new(
        provider: ProviderId,
        discovery: ProviderDiscovery,
        child: tokio::process::Child,
        connection: SdkConnection,
        updates: Arc<Mutex<PromptUpdateState>>,
    ) -> Self {
        Self {
            child: Some(child),
            connection: Some(connection),
            discovery,
            initialize_result: None,
            last_prompt: None,
            loaded_transcripts: BTreeMap::new(),
            live_sessions: BTreeMap::new(),
            provider,
            updates,
        }
    }

    fn spawn_transport(
        provider: ProviderId,
        launcher: &LauncherCommand,
        environment: &ProcessEnvironment,
    ) -> Result<(SdkTransport, tokio::process::Child)> {
        let mut command = tokio::process::Command::new(&launcher.executable);
        command
            .args(&launcher.args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);
        apply_process_environment(&mut command, environment);
        let mut child = command
            .spawn()
            .map_err(|source| AcpError::Spawn { provider, source })?;
        let outgoing = child_stdin(provider, &mut child)?;
        let incoming = child_stdout(provider, &mut child)?;
        drain_child_stderr(provider, &mut child)?;
        Ok((acp_sdk::ByteStreams::new(outgoing, incoming), child))
    }

    async fn run_connected(args: ConnectedActor) -> Result<()> {
        let mut actor = Self::new(
            args.provider,
            args.discovery,
            args.child,
            args.connection,
            args.updates,
        );
        actor.run(args.commands).await;
        Ok(())
    }

    async fn run(&mut self, mut commands: UnboundedReceiver<HostCommand>) {
        while let Some(command) = commands.recv().await {
            self.handle_command(command).await;
        }
        self.disconnect().await;
    }

    async fn handle_command(&mut self, command: HostCommand) {
        match command {
            HostCommand::Initialize { request, reply } => {
                let result = self.initialize(request).await;
                send_reply(reply, result);
            }
            HostCommand::InitializeResult { reply } => {
                send_reply(reply, Ok(self.initialize_result()));
            }
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
        let capabilities = self
            .initialize_result
            .as_ref()
            .and_then(|result| to_value(&result.response.agent_capabilities).ok())
            .unwrap_or(Value::Null);
        let auth_methods = self
            .initialize_result
            .as_ref()
            .and_then(|result| to_value(&result.response.auth_methods).ok())
            .and_then(|value| serde_json::from_value(value).ok())
            .unwrap_or_default();
        ProviderSnapshot {
            provider: self.provider,
            connection_state: self.connection_state(),
            discovery: self.discovery.clone(),
            capabilities,
            auth_methods,
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
            .initialized_connection("session/new")?
            .send_request(acp::NewSessionRequest::new(cwd))
            .block_task()
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
            .initialized_connection("session/list")?
            .send_request(request)
            .block_task()
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
            .initialized_connection("session/load")?
            .send_request(acp::LoadSessionRequest::new(
                session_id.clone(),
                cwd.clone(),
            ))
            .block_task()
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
        self.initialized_connection("session/set_config_option")?
            .send_request(acp::SetSessionConfigOptionRequest::new(
                session_id, config_id, value,
            ))
            .block_task()
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
            .initialized_connection("session/prompt")?
            .send_request(acp::PromptRequest::new(session_id.clone(), prompt))
            .block_task();
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
        self.initialized_connection("session/cancel")?
            .send_notification(acp::CancelNotification::new(session_id))
            .map_err(|source| sdk_error(self.provider, "session/cancel", source))
    }

    async fn cancel_during_prompt(
        &self,
        session_id: &acp::SessionId,
        after: Duration,
        mut prompt: std::pin::Pin<
            &mut impl std::future::Future<Output = acp_sdk::Result<acp::PromptResponse>>,
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

    fn connection(&self) -> Result<&SdkConnection> {
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
        if self.initialize_result.is_none() {
            return ConnectionState::Connected;
        }
        ConnectionState::Ready
    }
}

fn drain_child_stderr(provider: ProviderId, child: &mut tokio::process::Child) -> Result<()> {
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| disconnected(provider, "stderr"))?;
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    tracing::debug!(
                        event_name = "acp_host.child_stderr.line",
                        source = "acp-core",
                        provider = %provider.as_str(),
                        line_bytes = line.len()
                    );
                }
                Ok(None) => {
                    tracing::debug!(
                        event_name = "acp_host.child_stderr.closed",
                        source = "acp-core",
                        provider = %provider.as_str()
                    );
                    break;
                }
                Err(error) => {
                    tracing::warn!(
                        event_name = "acp_host.child_stderr.read_error",
                        source = "acp-core",
                        provider = %provider.as_str(),
                        error_message = %error
                    );
                    break;
                }
            }
        }
    });
    Ok(())
}

include!("sdk_actor_tail.rs");
