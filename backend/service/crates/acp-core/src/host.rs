//! Live ACP host connection and locked-subset operations.

mod helpers;
mod internal;
mod receive;

use self::helpers::{identity, unexpected};
use crate::error::Result;
use crate::snapshot::{
    ConnectionState, LiveSessionSnapshot, PromptLifecycleSnapshot, ProviderSnapshot,
};
use crate::transport::Transport;
use crate::wire::RawWireEvent;
use acp_contracts::{
    LockedMethod, load_locked_contract_bundle, validate_locked_cancel_notification,
};
use acp_discovery::{
    ProcessEnvironment, ProviderDiscovery, ProviderId, discover_provider_with_environment,
    resolve_provider_command,
};
use agent_client_protocol_schema::{
    AGENT_METHOD_NAMES, AgentSide, ClientNotification, ClientRequest, ClientSide, JsonRpcMessage,
    ListSessionsRequest, ListSessionsResponse, LoadSessionRequest, LoadSessionResponse,
    NewSessionRequest, NewSessionResponse, Notification, OutgoingMessage, PromptResponse,
    SessionId,
};
use serde_json::{Value, to_value};
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const POLL_SLICE: Duration = Duration::from_millis(50);

/// One live ACP host connection owned by Conduit.
pub struct AcpHost {
    provider: ProviderId,
    discovery: ProviderDiscovery,
    capabilities: Value,
    auth_methods: Vec<Value>,
    transport: Transport,
    contract_bundle: acp_contracts::ContractBundle,
    next_request_id: i64,
    sequence: u64,
    raw_events: Vec<RawWireEvent>,
    request_envelopes: Vec<Value>,
    response_envelopes: Vec<Value>,
    live_sessions: BTreeMap<String, LiveSessionSnapshot>,
    last_prompt: Option<PromptLifecycleSnapshot>,
}

impl AcpHost {
    /// Connects to one official provider launcher and runs a live `initialize`.
    ///
    /// # Errors
    ///
    /// Returns an error when discovery fails, the provider process cannot be
    /// spawned, the vendored ACP contract cannot be loaded, or the live
    /// `initialize` exchange fails validation.
    pub fn connect(provider: ProviderId) -> Result<Self> {
        Self::connect_with_environment(provider, &ProcessEnvironment::empty())
    }

    /// Connects to one official provider launcher with explicit process
    /// environment overrides and runs a live `initialize`.
    ///
    /// # Errors
    ///
    /// Returns an error under the same conditions as [`Self::connect`] while
    /// also applying the supplied launcher environment overrides.
    pub fn connect_with_environment(
        provider: ProviderId,
        environment: &ProcessEnvironment,
    ) -> Result<Self> {
        let discovery = discover_provider_with_environment(provider, environment)?;
        let launcher = resolve_provider_command(provider)?;
        let transport = Transport::spawn(provider, &launcher, environment)?;
        let contract_bundle = load_locked_contract_bundle()?;
        let mut host = Self {
            provider,
            capabilities: Value::Null,
            auth_methods: Vec::new(),
            transport,
            contract_bundle,
            next_request_id: 1,
            sequence: 0,
            raw_events: Vec::new(),
            request_envelopes: Vec::new(),
            response_envelopes: Vec::new(),
            live_sessions: BTreeMap::new(),
            last_prompt: None,
            discovery,
        };
        let _initialize = host.initialize()?;
        host.capabilities = host.initialize_field("agentCapabilities");
        host.auth_methods = host.initialize_auth_methods();
        Ok(host)
    }

    /// Disconnects the live provider process.
    pub fn disconnect(&mut self) {
        self.transport.shutdown();
    }

    /// Returns the current provider snapshot.
    #[must_use]
    pub fn snapshot(&self) -> ProviderSnapshot {
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

    /// Returns the raw wire events captured so far.
    #[must_use]
    pub fn raw_events(&self) -> &[RawWireEvent] {
        &self.raw_events
    }

    /// Returns the outbound ACP envelopes captured so far.
    #[must_use]
    pub fn request_envelopes(&self) -> &[Value] {
        &self.request_envelopes
    }

    /// Returns the inbound ACP responses captured so far.
    #[must_use]
    pub fn response_envelopes(&self) -> &[Value] {
        &self.response_envelopes
    }

    fn connection_state(&self) -> ConnectionState {
        if self.transport.is_connected() {
            ConnectionState::Ready
        } else {
            ConnectionState::Disconnected
        }
    }

    /// Creates one new ACP session under the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the ACP request cannot be serialized, sent, or
    /// validated, or when the provider returns an invalid `session/new`
    /// response.
    pub fn new_session(
        &mut self,
        cwd: impl Into<std::path::PathBuf>,
    ) -> Result<NewSessionResponse> {
        let cwd = cwd.into();
        let cwd_text = cwd.display().to_string();
        let request = ClientRequest::NewSessionRequest(NewSessionRequest::new(cwd));
        let response: NewSessionResponse =
            self.round_trip("session/new", request, LockedMethod::SessionNew)?;
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

    /// Lists ACP sessions from the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the ACP request cannot be serialized, sent, or
    /// validated, or when the provider returns an invalid `session/list`
    /// response.
    pub fn list_sessions(&mut self) -> Result<ListSessionsResponse> {
        let response: ListSessionsResponse = self.round_trip(
            "session/list",
            ClientRequest::ListSessionsRequest(ListSessionsRequest::new()),
            LockedMethod::SessionList,
        )?;
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

    /// Loads one ACP session from the current provider connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the ACP request cannot be serialized, sent, or
    /// validated, or when the provider returns an invalid `session/load`
    /// response.
    pub fn load_session(
        &mut self,
        session_id: impl Into<SessionId>,
        cwd: impl Into<std::path::PathBuf>,
    ) -> Result<LoadSessionResponse> {
        let session_id = session_id.into();
        let cwd = cwd.into();
        let response: LoadSessionResponse = self.round_trip(
            "session/load",
            ClientRequest::LoadSessionRequest(LoadSessionRequest::new(
                session_id.clone(),
                cwd.clone(),
            )),
            LockedMethod::SessionLoad,
        )?;
        self.live_sessions.insert(
            session_id.to_string(),
            LiveSessionSnapshot {
                identity: identity(self.provider, &session_id),
                cwd: cwd.display().to_string(),
                title: self
                    .live_sessions
                    .get(&session_id.to_string())
                    .and_then(|entry| entry.title.clone()),
                observed_via: "load".to_owned(),
            },
        );
        Ok(response)
    }

    /// Sends one text-only ACP prompt and waits for completion.
    ///
    /// # Errors
    ///
    /// Returns an error when the target session is unknown, the ACP request
    /// fails validation or transport, or the provider returns an invalid
    /// `session/prompt` response.
    pub fn prompt_text(&mut self, session_id: &str, text: &str) -> Result<PromptResponse> {
        self.run_prompt(session_id, text, None)
    }

    /// Sends one text-only ACP prompt and schedules a cancel notification.
    ///
    /// # Errors
    ///
    /// Returns an error under the same conditions as [`Self::prompt_text`] and
    /// also when the scheduled `session/cancel` notification cannot be sent.
    pub fn prompt_text_with_cancel(
        &mut self,
        session_id: &str,
        text: &str,
        cancel_after: Duration,
    ) -> Result<PromptResponse> {
        self.run_prompt(session_id, text, Some(cancel_after))
    }

    /// Sends one `session/cancel` notification on the current connection.
    ///
    /// # Errors
    ///
    /// Returns an error when the notification cannot be serialized, validated,
    /// or written to the live provider connection.
    pub fn cancel_prompt(&mut self, session_id: &str) -> Result<()> {
        let envelope = JsonRpcMessage::wrap(
            OutgoingMessage::<ClientSide, AgentSide>::Notification(Notification {
                method: Arc::from(AGENT_METHOD_NAMES.session_cancel),
                params: Some(ClientNotification::CancelNotification(
                    agent_client_protocol_schema::CancelNotification::new(SessionId::new(
                        session_id,
                    )),
                )),
            }),
        );
        let value =
            to_value(&envelope).map_err(|error| unexpected(self.provider, error.to_string()))?;
        validate_locked_cancel_notification(&self.contract_bundle, &value)?;
        self.send_json("session/cancel", &value)
    }
}
