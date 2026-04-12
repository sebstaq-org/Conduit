//! Official ACP SDK actor for one provider connection.

use super::helpers::{identity, session_update_variant, unexpected};
use super::prompt::{permission_response, prompt_content_blocks, stop_reason_string};
use crate::error::{AcpError, Result};
use crate::snapshot::{
    ConnectionState, LiveSessionSnapshot, LoadedTranscriptSnapshot, PromptLifecycleSnapshot,
    PromptLifecycleState, ProviderSnapshot, TranscriptUpdateSnapshot,
};
use acp_discovery::{LauncherCommand, ProcessEnvironment, ProviderDiscovery, ProviderId};
use agent_client_protocol::{self as acp, Agent as _};
use serde_json::{Value, to_value};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
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
}

impl HostCommand {
    pub(super) fn snapshot(reply: Sender<Result<ProviderSnapshot>>) -> Self {
        Self::Snapshot { reply }
    }

    pub(super) fn disconnect(reply: Sender<Result<()>>) -> Self {
        Self::Disconnect { reply }
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

#[derive(Default)]
struct PromptUpdateState {
    active_session: Option<String>,
    raw_update_count: usize,
    agent_text_chunks: Vec<String>,
    updates: Vec<TranscriptUpdateSnapshot>,
    update_sender: Option<Sender<TranscriptUpdateSnapshot>>,
}

struct PromptUpdates {
    raw_update_count: usize,
    agent_text_chunks: Vec<String>,
    updates: Vec<TranscriptUpdateSnapshot>,
}

#[derive(Clone)]
struct SdkClient {
    provider: ProviderId,
    updates: Arc<Mutex<PromptUpdateState>>,
}

#[async_trait::async_trait(?Send)]
impl acp::Client for SdkClient {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> acp::Result<acp::RequestPermissionResponse> {
        Ok(permission_response(args))
    }

    async fn session_notification(&self, args: acp::SessionNotification) -> acp::Result<()> {
        let mut updates = self.updates.lock().map_err(|error| {
            acp::Error::internal_error().data(format!(
                "prompt update lock poisoned for {}: {error}",
                self.provider
            ))
        })?;
        if updates.active_session.as_deref() == Some(&args.session_id.to_string()) {
            updates.raw_update_count += 1;
            let index = updates.raw_update_count.saturating_sub(1);
            let update = to_value(&args.update).map_err(|error| {
                acp::Error::internal_error().data(format!(
                    "session update serialization failed for {}: {error}",
                    self.provider
                ))
            })?;
            let variant = session_update_variant(&args.update, &update);
            let snapshot = TranscriptUpdateSnapshot {
                index,
                variant,
                update,
            };
            if let Some(update_sender) = &updates.update_sender {
                let _result = update_sender.send(snapshot.clone());
            }
            updates.updates.push(snapshot);
            if let acp::SessionUpdate::AgentMessageChunk(chunk) = &args.update
                && let acp::ContentBlock::Text(text) = &chunk.content
            {
                updates.agent_text_chunks.push(text.text.clone());
            }
        }
        Ok(())
    }
}

pub(super) struct ActorBootstrap {
    pub(super) provider: ProviderId,
    pub(super) discovery: ProviderDiscovery,
    pub(super) launcher: LauncherCommand,
    pub(super) environment: ProcessEnvironment,
    pub(super) commands: UnboundedReceiver<HostCommand>,
    pub(super) init: Sender<Result<ProviderSnapshot>>,
}

pub(super) fn spawn_actor(bootstrap: ActorBootstrap) -> Result<()> {
    let provider = bootstrap.provider;
    thread::Builder::new()
        .name(format!("conduit-acp-host-{provider}"))
        .spawn(move || run_actor_thread(bootstrap))
        .map(|_handle| ())
        .map_err(|source| AcpError::Spawn { provider, source })
}

fn run_actor_thread(bootstrap: ActorBootstrap) {
    let provider = bootstrap.provider;
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            send_reply(bootstrap.init, Err(unexpected(provider, error.to_string())));
            return;
        }
    };
    let local = tokio::task::LocalSet::new();
    local.block_on(&runtime, async move {
        run_actor(bootstrap).await;
    });
}

async fn run_actor(bootstrap: ActorBootstrap) {
    let provider = bootstrap.provider;
    match SdkHostActor::connect(
        provider,
        bootstrap.discovery,
        bootstrap.launcher,
        bootstrap.environment,
    )
    .await
    {
        Ok(mut actor) => {
            send_reply(bootstrap.init, Ok(actor.snapshot()));
            actor.run(bootstrap.commands).await;
        }
        Err(error) => send_reply(bootstrap.init, Err(error)),
    }
}

fn spawn_sdk_connection(
    provider: ProviderId,
    launcher: &LauncherCommand,
    environment: &ProcessEnvironment,
    updates: &Arc<Mutex<PromptUpdateState>>,
) -> Result<(acp::ClientSideConnection, tokio::process::Child)> {
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
    let client = SdkClient {
        provider,
        updates: Arc::clone(updates),
    };
    let (connection, io_task) =
        acp::ClientSideConnection::new(client, outgoing, incoming, |future| {
            tokio::task::spawn_local(future);
        });
    tokio::task::spawn_local(io_task);
    Ok((connection, child))
}

fn child_stdin(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<tokio_util::compat::Compat<tokio::process::ChildStdin>> {
    child
        .stdin
        .take()
        .map(TokioAsyncWriteCompatExt::compat_write)
        .ok_or_else(|| disconnected(provider, "stdin"))
}

fn child_stdout(
    provider: ProviderId,
    child: &mut tokio::process::Child,
) -> Result<tokio_util::compat::Compat<tokio::process::ChildStdout>> {
    child
        .stdout
        .take()
        .map(TokioAsyncReadCompatExt::compat)
        .ok_or_else(|| disconnected(provider, "stdout"))
}

fn update_session_tracker(
    updates: &Arc<Mutex<PromptUpdateState>>,
    active_session: Option<String>,
    raw_update_count: usize,
    update_sender: Option<Sender<TranscriptUpdateSnapshot>>,
    provider: ProviderId,
) -> Result<()> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    updates.active_session = active_session;
    updates.raw_update_count = raw_update_count;
    updates.agent_text_chunks.clear();
    updates.updates.clear();
    updates.update_sender = update_sender;
    Ok(())
}

fn take_session_updates(
    updates: &Arc<Mutex<PromptUpdateState>>,
    provider: ProviderId,
) -> Result<PromptUpdates> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    let count = updates.raw_update_count;
    let agent_text_chunks = std::mem::take(&mut updates.agent_text_chunks);
    let captured_updates = std::mem::take(&mut updates.updates);
    updates.active_session = None;
    updates.raw_update_count = 0;
    updates.update_sender = None;
    Ok(PromptUpdates {
        raw_update_count: count,
        agent_text_chunks,
        updates: captured_updates,
    })
}

fn child_has_exited(child: &mut Option<tokio::process::Child>) -> bool {
    child
        .as_mut()
        .and_then(|process| process.try_wait().ok())
        .flatten()
        .is_some()
}

fn to_values<T>(provider: ProviderId, values: Vec<T>, field: &str) -> Result<Vec<Value>>
where
    T: serde::Serialize,
{
    values
        .into_iter()
        .map(|value| {
            to_value(value).map_err(|error| unexpected(provider, format!("{field}: {error}")))
        })
        .collect()
}

fn disconnected(provider: ProviderId, operation: &str) -> AcpError {
    AcpError::StreamClosed {
        provider,
        stream: "official-sdk".to_owned(),
        operation: operation.to_owned(),
    }
}

pub(super) fn disconnected_snapshot(
    provider: ProviderId,
    discovery: ProviderDiscovery,
) -> ProviderSnapshot {
    ProviderSnapshot {
        provider,
        connection_state: ConnectionState::Disconnected,
        discovery,
        capabilities: Value::Null,
        auth_methods: Vec::new(),
        live_sessions: Vec::new(),
        last_prompt: None,
        loaded_transcripts: Vec::new(),
    }
}

fn apply_process_environment(
    command: &mut tokio::process::Command,
    environment: &ProcessEnvironment,
) {
    if let Some(current_dir) = &environment.current_dir {
        command.current_dir(current_dir);
    }
    for (key, value) in &environment.env {
        command.env(key, value);
    }
}

pub(super) fn receive_result<T>(
    provider: ProviderId,
    operation: &'static str,
    response: Receiver<Result<T>>,
) -> Result<T> {
    response
        .recv()
        .map_err(|_error| actor_stopped(provider, operation))?
}

fn send_reply<T>(reply: Sender<Result<T>>, result: Result<T>) {
    let _result = reply.send(result);
}

fn sdk_error(provider: ProviderId, operation: &str, source: acp::Error) -> AcpError {
    AcpError::Sdk {
        provider,
        operation: operation.to_owned(),
        source,
    }
}

pub(super) fn actor_stopped(provider: ProviderId, operation: &str) -> AcpError {
    AcpError::ActorStopped {
        provider,
        operation: operation.to_owned(),
    }
}
