//! Live ACP host connection and locked-subset operations.

mod helpers;
mod prompt;
mod sdk_actor;

use self::sdk_actor::{
    ActorBootstrap, HostCommand, actor_stopped, disconnected_snapshot, receive_result, spawn_actor,
};
use crate::error::Result;
use crate::initialize::{ProviderInitializeRequest, ProviderInitializeResult};
use crate::snapshot::{ProviderSnapshot, TranscriptUpdateSnapshot};
use crate::wire::RawWireEvent;
use acp_contracts::load_locked_contract_bundle;
use acp_discovery::{
    ProcessEnvironment, ProviderDiscovery, ProviderId, discover_provider_with_environment,
    resolve_provider_command,
};
use agent_client_protocol::schema as acp;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender, channel};
use std::time::{Duration, Instant};
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};

/// User interaction response payload accepted by `session/respond_interaction`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InteractionResponse {
    /// Select one predefined option.
    Selected {
        /// Selected option identifier.
        option_id: String,
    },
    /// Select the free-text option with one answer string.
    AnswerOther {
        /// Option id, typically `answer-other`.
        option_id: String,
        /// Question id associated with the free-text answer.
        question_id: String,
        /// Free-text response content.
        text: String,
    },
    /// Cancel the pending interaction.
    Cancelled,
}

enum PromptReceiveStep {
    Disconnected,
    Done(Result<acp::PromptResponse>),
    Pending,
}

/// One live ACP host connection owned by Conduit.
pub struct AcpHost {
    discovery: ProviderDiscovery,
    provider: ProviderId,
    commands: UnboundedSender<HostCommand>,
}

impl AcpHost {
    /// Connects to one official provider launcher without initializing ACP.
    ///
    /// # Errors
    ///
    /// Returns an error when discovery fails, the provider process cannot be
    /// spawned, or the vendored ACP contract cannot be loaded.
    pub fn connect(provider: ProviderId) -> Result<Self> {
        Self::connect_with_environment(provider, &ProcessEnvironment::empty())
    }

    /// Connects to one official provider launcher with explicit process
    /// environment overrides without initializing ACP.
    ///
    /// # Errors
    ///
    /// Returns an error under the same conditions as [`Self::connect`] while
    /// also applying the supplied launcher environment overrides.
    pub fn connect_with_environment(
        provider: ProviderId,
        environment: &ProcessEnvironment,
    ) -> Result<Self> {
        let started_at = Instant::now();
        tracing::info!(
            event_name = "acp_host.connect.start",
            source = "acp-core",
            provider = %provider.as_str()
        );
        let discovery = discover_provider_with_environment(provider, environment)?;
        let launcher = resolve_provider_command(provider)?;
        let locked_contract = load_locked_contract_bundle()?;
        std::mem::drop(locked_contract);

        let (commands, command_rx) = unbounded_channel();
        let (connect_tx, connect_rx) = channel();
        spawn_actor(ActorBootstrap {
            provider,
            discovery: discovery.clone(),
            launcher,
            environment: environment.clone(),
            commands: command_rx,
            init: connect_tx,
        })?;
        receive_result(provider, "provider/connect", connect_rx)?;
        tracing::info!(
            event_name = "acp_host.connect.finish",
            source = "acp-core",
            provider = %provider.as_str(),
            ok = true,
            duration_ms = started_at.elapsed().as_millis()
        );
        Ok(Self {
            discovery,
            provider,
            commands,
        })
    }

    /// Runs ACP `initialize` on the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `initialize` call.
    pub fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        self.request("initialize", |reply| HostCommand::Initialize {
            request,
            reply,
        })
    }

    /// Returns the completed ACP `initialize` exchange when available.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider actor cannot answer the request.
    pub fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        self.request("initialize/result", |reply| HostCommand::InitializeResult {
            reply,
        })
    }

    /// Disconnects the live provider process.
    pub fn disconnect(&mut self) {
        tracing::debug!(
            event_name = "acp_host.disconnect",
            source = "acp-core",
            provider = %self.provider.as_str()
        );
        let _result = self.request("provider/disconnect", HostCommand::disconnect);
    }

    /// Returns the current provider snapshot.
    #[must_use]
    pub fn snapshot(&self) -> ProviderSnapshot {
        match self.request("provider/snapshot", HostCommand::snapshot) {
            Ok(snapshot) => snapshot,
            Err(_error) => disconnected_snapshot(self.provider, self.discovery.clone()),
        }
    }

    /// Returns the raw wire events captured so far.
    ///
    /// The official SDK is now the ACP host boundary. This vector is empty
    /// unless the SDK exposes raw transport capture without custom JSON-RPC
    /// transport ownership.
    #[must_use]
    pub fn raw_events(&self) -> &[RawWireEvent] {
        &[]
    }

    /// Returns the outbound ACP envelopes captured so far.
    ///
    /// The official SDK owns request encoding, so no Conduit-owned runtime
    /// envelopes are exposed here.
    #[must_use]
    pub fn request_envelopes(&self) -> &[Value] {
        &[]
    }

    /// Returns the inbound ACP responses captured so far.
    ///
    /// The official SDK owns response decoding, so no Conduit-owned runtime
    /// envelopes are exposed here.
    #[must_use]
    pub fn response_envelopes(&self) -> &[Value] {
        &[]
    }

    /// Creates one new ACP session under the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/new` call.
    pub fn new_session(&mut self, cwd: impl Into<PathBuf>) -> Result<acp::NewSessionResponse> {
        let cwd = cwd.into();
        self.request("session/new", |reply| HostCommand::NewSession {
            cwd,
            reply,
        })
    }

    /// Lists ACP sessions from the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/list` call.
    pub fn list_sessions(&mut self) -> Result<acp::ListSessionsResponse> {
        self.list_sessions_filtered(None, None)
    }

    /// Lists ACP sessions with optional official `cwd` and `cursor` filters.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/list` call.
    pub fn list_sessions_filtered(
        &mut self,
        cwd: Option<PathBuf>,
        cursor: Option<String>,
    ) -> Result<acp::ListSessionsResponse> {
        self.request("session/list", |reply| HostCommand::ListSessions {
            cwd,
            cursor,
            reply,
        })
    }

    /// Loads one ACP session from the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/load` call.
    pub fn load_session(
        &mut self,
        session_id: impl Into<acp::SessionId>,
        cwd: impl Into<PathBuf>,
    ) -> Result<acp::LoadSessionResponse> {
        let session_id = session_id.into();
        let cwd = cwd.into();
        self.request("session/load", |reply| HostCommand::LoadSession {
            session_id,
            cwd,
            reply,
        })
    }

    /// Sends one text-only ACP prompt and waits for completion.
    ///
    /// # Errors
    ///
    /// Returns an error when the target session is unknown or the provider
    /// rejects or fails the official SDK `session/prompt` call.
    pub fn prompt_text(&mut self, session_id: &str, text: &str) -> Result<acp::PromptResponse> {
        self.prompt_content_blocks(
            session_id,
            vec![json!({ "type": "text", "text": text })],
            &mut |_update| {},
        )
    }

    /// Sends one text-only ACP prompt and schedules a cancel notification.
    ///
    /// # Errors
    ///
    /// Returns an error under the same conditions as [`Self::prompt_text`] and
    /// also when the scheduled official SDK `session/cancel` notification fails.
    pub fn prompt_text_with_cancel(
        &mut self,
        session_id: &str,
        text: &str,
        cancel_after: Duration,
    ) -> Result<acp::PromptResponse> {
        self.prompt(
            session_id,
            vec![json!({ "type": "text", "text": text })],
            Some(cancel_after),
            &mut |_update| {},
        )
    }

    /// Sends one ACP content-block prompt and reports observed prompt updates
    /// while the prompt request is in flight.
    ///
    /// # Errors
    ///
    /// Returns an error when content blocks cannot be decoded into the official
    /// ACP schema or the provider rejects or fails `session/prompt`.
    pub fn prompt_content_blocks(
        &mut self,
        session_id: &str,
        prompt: Vec<Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<acp::PromptResponse> {
        self.prompt(session_id, prompt, None, update_sink)
    }

    /// Sends one `session/cancel` notification on the current connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/cancel` notification.
    pub fn cancel_prompt(&mut self, session_id: &str) -> Result<()> {
        self.request("session/cancel", |reply| HostCommand::CancelPrompt {
            session_id: acp::SessionId::new(session_id),
            reply,
        })
    }

    /// Sends one `session/set_config_option` request on the current connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the official SDK
    /// `session/set_config_option` request.
    pub fn set_session_config_option(
        &mut self,
        session_id: &str,
        config_id: &str,
        value: &str,
    ) -> Result<acp::SetSessionConfigOptionResponse> {
        self.request("session/set_config_option", |reply| {
            HostCommand::SetSessionConfigOption {
                session_id: acp::SessionId::new(session_id),
                config_id: config_id.to_owned(),
                value: value.to_owned(),
                reply,
            }
        })
    }

    /// Responds to one pending provider interaction while prompt is active.
    ///
    /// # Errors
    ///
    /// Returns an error when the interaction id is unknown, already resolved,
    /// or the response payload does not satisfy ACP interaction requirements.
    pub fn respond_interaction(
        &self,
        session_id: &str,
        interaction_id: &str,
        response: InteractionResponse,
    ) -> Result<()> {
        sdk_actor::respond_interaction(self.provider, session_id, interaction_id, response)
    }

    fn prompt(
        &mut self,
        session_id: &str,
        prompt: Vec<Value>,
        cancel_after: Option<Duration>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<acp::PromptResponse> {
        let started_at = Instant::now();
        log_prompt_start(self.provider, session_id, cancel_after, &prompt);
        let (reply, response) = channel();
        let (updates, prompt_updates) = channel();
        self.commands
            .send(HostCommand::PromptContent {
                session_id: acp::SessionId::new(session_id),
                prompt,
                cancel_after,
                updates,
                reply,
            })
            .map_err(|_error| actor_stopped(self.provider, "session/prompt"))?;
        let result = receive_prompt_result(self.provider, response, prompt_updates, update_sink);
        log_request_finish(self.provider, "session/prompt", started_at, &result);
        result
    }

    fn request<T>(
        &self,
        operation: &'static str,
        command: impl FnOnce(Sender<Result<T>>) -> HostCommand,
    ) -> Result<T>
    where
        T: Send + 'static,
    {
        let started_at = Instant::now();
        log_request_start(self.provider, operation);
        let (reply, response) = channel();
        self.commands
            .send(command(reply))
            .map_err(|_error| actor_stopped(self.provider, operation))?;
        let result = receive_result(self.provider, operation, response);
        log_request_finish(self.provider, operation, started_at, &result);
        result
    }
}

impl Drop for AcpHost {
    fn drop(&mut self) {
        self.disconnect();
    }
}

fn receive_prompt_result(
    provider: ProviderId,
    response: Receiver<Result<acp::PromptResponse>>,
    prompt_updates: Receiver<TranscriptUpdateSnapshot>,
    update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
) -> Result<acp::PromptResponse> {
    log_prompt_updates_listen_start(provider);
    loop {
        drain_prompt_updates(&prompt_updates, update_sink);
        match receive_prompt_step(&response) {
            PromptReceiveStep::Pending => {}
            PromptReceiveStep::Done(result) => {
                return finish_prompt_result(provider, &prompt_updates, update_sink, result);
            }
            PromptReceiveStep::Disconnected => {
                return prompt_response_disconnected(provider);
            }
        }
    }
}

fn log_request_start(provider: ProviderId, operation: &'static str) {
    tracing::debug!(
        event_name = "acp_host.request.start",
        source = "acp-core",
        provider = %provider.as_str(),
        operation
    );
}

fn log_prompt_start(
    provider: ProviderId,
    session_id: &str,
    cancel_after: Option<Duration>,
    prompt: &[Value],
) {
    tracing::debug!(
        event_name = "acp_host.request.start",
        source = "acp-core",
        provider = %provider.as_str(),
        operation = "session/prompt",
        session_id,
        cancel_after_ms = cancel_after.map(|value| value.as_millis()),
        prompt = ?prompt
    );
}

fn log_request_finish<T>(
    provider: ProviderId,
    operation: &'static str,
    started_at: Instant,
    result: &Result<T>,
) {
    match result {
        Ok(_) => log_request_success(provider, operation, started_at),
        Err(error) => log_request_failure(provider, operation, started_at, error),
    }
}

fn log_request_success(provider: ProviderId, operation: &'static str, started_at: Instant) {
    tracing::info!(
        event_name = "acp_host.request.finish",
        source = "acp-core",
        provider = %provider.as_str(),
        operation,
        ok = true,
        duration_ms = started_at.elapsed().as_millis()
    );
}

fn log_request_failure(
    provider: ProviderId,
    operation: &'static str,
    started_at: Instant,
    error: &impl std::fmt::Display,
) {
    tracing::warn!(
        event_name = "acp_host.request.finish",
        source = "acp-core",
        provider = %provider.as_str(),
        operation,
        ok = false,
        duration_ms = started_at.elapsed().as_millis(),
        error_message = %error
    );
}

fn log_prompt_updates_listen_start(provider: ProviderId) {
    tracing::debug!(
        event_name = "acp_host.prompt_updates.listen.start",
        source = "acp-core",
        provider = %provider.as_str()
    );
}

fn drain_prompt_updates(
    prompt_updates: &Receiver<TranscriptUpdateSnapshot>,
    update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
) {
    for update in prompt_updates.try_iter() {
        update_sink(update);
    }
}

fn receive_prompt_step(response: &Receiver<Result<acp::PromptResponse>>) -> PromptReceiveStep {
    match response.recv_timeout(Duration::from_millis(10)) {
        Ok(result) => PromptReceiveStep::Done(result),
        Err(RecvTimeoutError::Timeout) => PromptReceiveStep::Pending,
        Err(RecvTimeoutError::Disconnected) => PromptReceiveStep::Disconnected,
    }
}

fn finish_prompt_result(
    provider: ProviderId,
    prompt_updates: &Receiver<TranscriptUpdateSnapshot>,
    update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    result: Result<acp::PromptResponse>,
) -> Result<acp::PromptResponse> {
    drain_prompt_updates(prompt_updates, update_sink);
    tracing::debug!(
        event_name = "acp_host.prompt_updates.listen.finish",
        source = "acp-core",
        provider = %provider.as_str(),
        ok = true
    );
    result
}

fn prompt_response_disconnected(provider: ProviderId) -> Result<acp::PromptResponse> {
    tracing::warn!(
        event_name = "acp_host.prompt_updates.listen.finish",
        source = "acp-core",
        provider = %provider.as_str(),
        ok = false,
        error_message = "prompt response channel disconnected"
    );
    Err(actor_stopped(provider, "session/prompt"))
}
