//! Official ACP SDK actor for one provider connection.

use super::helpers::{identity, unexpected};
use crate::error::{AcpError, Result};
use crate::snapshot::{
    ConnectionState, LiveSessionSnapshot, PromptLifecycleSnapshot, PromptLifecycleState,
    ProviderSnapshot,
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
        reply: Sender<Result<acp::ListSessionsResponse>>,
    },
    LoadSession {
        session_id: acp::SessionId,
        cwd: PathBuf,
        reply: Sender<Result<acp::LoadSessionResponse>>,
    },
    PromptText {
        session_id: acp::SessionId,
        text: String,
        cancel_after: Option<Duration>,
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
            HostCommand::ListSessions { reply } => {
                let result = self.list_sessions().await;
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
            HostCommand::PromptText {
                session_id,
                text,
                cancel_after,
                reply,
            } => {
                let result = self.prompt_text(session_id, text, cancel_after).await;
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

    async fn list_sessions(&mut self) -> Result<acp::ListSessionsResponse> {
        let response = self
            .connection()?
            .list_sessions(acp::ListSessionsRequest::new())
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
        let response = self
            .connection()?
            .load_session(acp::LoadSessionRequest::new(
                session_id.clone(),
                cwd.clone(),
            ))
            .await
            .map_err(|source| sdk_error(self.provider, "session/load", source))?;
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
        Ok(response)
    }

    async fn prompt_text(
        &mut self,
        session_id: acp::SessionId,
        text: String,
        cancel_after: Option<Duration>,
    ) -> Result<acp::PromptResponse> {
        self.ensure_known_session(&session_id)?;
        self.start_prompt(&session_id)?;
        let response = self
            .prompt_with_optional_cancel(&session_id, text, cancel_after)
            .await?;
        self.finish_prompt(&session_id, &response)?;
        Ok(response)
    }

    async fn prompt_with_optional_cancel(
        &self,
        session_id: &acp::SessionId,
        text: String,
        cancel_after: Option<Duration>,
    ) -> Result<acp::PromptResponse> {
        let prompt = self.connection()?.prompt(acp::PromptRequest::new(
            session_id.clone(),
            vec![text.into()],
        ));
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

    fn start_prompt(&mut self, session_id: &acp::SessionId) -> Result<()> {
        update_prompt_tracker(
            &self.updates,
            Some(session_id.to_string()),
            0,
            self.provider,
        )?;
        self.last_prompt = Some(PromptLifecycleSnapshot {
            identity: identity(self.provider, session_id),
            state: PromptLifecycleState::Running,
            stop_reason: None,
            raw_update_count: 0,
            agent_text_chunks: Vec::new(),
        });
        Ok(())
    }

    fn finish_prompt(
        &mut self,
        session_id: &acp::SessionId,
        response: &acp::PromptResponse,
    ) -> Result<()> {
        let updates = take_prompt_updates(&self.updates, self.provider)?;
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
}

struct PromptUpdates {
    raw_update_count: usize,
    agent_text_chunks: Vec<String>,
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
        _args: acp::RequestPermissionRequest,
    ) -> acp::Result<acp::RequestPermissionResponse> {
        Err(acp::Error::method_not_found())
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
            if let acp::SessionUpdate::AgentMessageChunk(chunk) = args.update
                && let acp::ContentBlock::Text(text) = chunk.content
            {
                updates.agent_text_chunks.push(text.text);
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

fn update_prompt_tracker(
    updates: &Arc<Mutex<PromptUpdateState>>,
    active_session: Option<String>,
    raw_update_count: usize,
    provider: ProviderId,
) -> Result<()> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    updates.active_session = active_session;
    updates.raw_update_count = raw_update_count;
    updates.agent_text_chunks.clear();
    Ok(())
}

fn take_prompt_updates(
    updates: &Arc<Mutex<PromptUpdateState>>,
    provider: ProviderId,
) -> Result<PromptUpdates> {
    let mut updates = updates
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    let count = updates.raw_update_count;
    let agent_text_chunks = std::mem::take(&mut updates.agent_text_chunks);
    updates.active_session = None;
    updates.raw_update_count = 0;
    Ok(PromptUpdates {
        raw_update_count: count,
        agent_text_chunks,
    })
}

fn child_has_exited(child: &mut Option<tokio::process::Child>) -> bool {
    child
        .as_mut()
        .and_then(|process| process.try_wait().ok())
        .flatten()
        .is_some()
}

fn stop_reason_string(response: &acp::PromptResponse) -> Option<String> {
    to_value(response.stop_reason)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
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
