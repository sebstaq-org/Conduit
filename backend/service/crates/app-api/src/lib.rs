//! Thin Conduit app API over the locked ACP Phase 1 subset.

#![forbid(unsafe_code)]
#![deny(
    missing_docs,
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::invalid_codeblock_attributes,
    rustdoc::invalid_rust_codeblocks,
    rustdoc::missing_crate_level_docs,
    rustdoc::private_intra_doc_links
)]

use acp_contracts::LOCKED_ACP_METHODS;
use acp_core::{
    AcpHost, InteractionResponse, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot,
};
use acp_discovery::{ProcessEnvironment, ProviderId};
use agent_client_protocol_schema::{
    ListSessionsResponse, LoadSessionResponse, NewSessionResponse, PromptResponse,
    SetSessionConfigOptionResponse,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

/// Result type for app API operations.
pub type Result<T> = acp_core::Result<T>;

/// The live app-facing Phase 1 service surface.
pub struct AppService {
    host: AcpHost,
}

/// One stable snapshot returned to app callers after each operation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppOperationSnapshot {
    /// The current provider snapshot.
    pub provider: ProviderSnapshot,
    /// The raw wire events captured so far.
    pub raw_events: Vec<RawWireEvent>,
}

impl AppService {
    /// Connects one provider and runs live `initialize`.
    ///
    /// # Errors
    ///
    /// Returns an error when discovery fails, the provider process cannot be
    /// spawned, or the live `initialize` exchange fails ACP validation.
    pub fn connect_provider(provider: ProviderId) -> Result<Self> {
        tracing::info!(
            event_name = "app_api.connect_provider.start",
            source = "app-api",
            provider = %provider.as_str()
        );
        Ok(Self {
            host: AcpHost::connect(provider)?,
        })
    }

    /// Connects one provider with explicit launcher environment overrides and
    /// runs live `initialize`.
    ///
    /// # Errors
    ///
    /// Returns an error under the same conditions as [`Self::connect_provider`]
    /// while also applying the supplied launcher environment overrides.
    pub fn connect_provider_with_environment(
        provider: ProviderId,
        environment: &ProcessEnvironment,
    ) -> Result<Self> {
        tracing::info!(
            event_name = "app_api.connect_provider_with_environment.start",
            source = "app-api",
            provider = %provider.as_str(),
            environment_vars = environment.env.len()
        );
        Ok(Self {
            host: AcpHost::connect_with_environment(provider, environment)?,
        })
    }

    /// Disconnects the active provider.
    pub fn disconnect_provider(&mut self) {
        tracing::debug!(
            event_name = "app_api.disconnect_provider",
            source = "app-api"
        );
        self.host.disconnect();
    }

    /// Returns the current provider snapshot.
    #[must_use]
    pub fn get_provider_snapshot(&self) -> ProviderSnapshot {
        self.host.snapshot()
    }

    /// Creates one new ACP session.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/new`.
    pub fn new_session(&mut self, cwd: PathBuf) -> Result<NewSessionResponse> {
        tracing::debug!(
            event_name = "app_api.new_session",
            source = "app-api",
            cwd = %cwd.display()
        );
        self.host.new_session(cwd)
    }

    /// Lists ACP sessions.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/list`.
    pub fn list_sessions(&mut self) -> Result<ListSessionsResponse> {
        tracing::debug!(event_name = "app_api.list_sessions", source = "app-api");
        self.host.list_sessions()
    }

    /// Lists ACP sessions with optional official `cwd` and `cursor` filters.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/list`.
    pub fn list_sessions_filtered(
        &mut self,
        cwd: Option<PathBuf>,
        cursor: Option<String>,
    ) -> Result<ListSessionsResponse> {
        self.host.list_sessions_filtered(cwd, cursor)
    }

    /// Loads one ACP session.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/load`.
    pub fn load_session(
        &mut self,
        session_id: impl Into<String>,
        cwd: PathBuf,
    ) -> Result<LoadSessionResponse> {
        let session_id = session_id.into();
        tracing::debug!(
            event_name = "app_api.load_session",
            source = "app-api",
            session_id = %session_id,
            cwd = %cwd.display()
        );
        self.host.load_session(session_id, cwd)
    }

    /// Sends one text-only prompt without cancellation.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/prompt`.
    pub fn prompt_text(&mut self, session_id: &str, text: &str) -> Result<PromptResponse> {
        tracing::debug!(
            event_name = "app_api.prompt_text",
            source = "app-api",
            session_id,
            text
        );
        self.host.prompt_text(session_id, text)
    }

    /// Sends one ACP content-block prompt without cancellation.
    ///
    /// # Errors
    ///
    /// Returns an error when the content blocks do not match the official ACP
    /// schema or the underlying live ACP host cannot complete `session/prompt`.
    pub fn prompt_content_blocks(
        &mut self,
        session_id: &str,
        prompt: Vec<serde_json::Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<PromptResponse> {
        self.host
            .prompt_content_blocks(session_id, prompt, update_sink)
    }

    /// Sends one text-only prompt and schedules a cancel notification.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete the
    /// prompt or the scheduled `session/cancel`.
    pub fn prompt_text_with_cancel(
        &mut self,
        session_id: &str,
        text: &str,
        cancel_after: Duration,
    ) -> Result<PromptResponse> {
        self.host
            .prompt_text_with_cancel(session_id, text, cancel_after)
    }

    /// Sends one explicit `session/cancel` notification.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot send
    /// `session/cancel`.
    pub fn cancel_prompt(&mut self, session_id: &str) -> Result<()> {
        tracing::debug!(
            event_name = "app_api.cancel_prompt",
            source = "app-api",
            session_id
        );
        self.host.cancel_prompt(session_id)
    }

    /// Sends one explicit `session/set_config_option` request.
    ///
    /// # Errors
    ///
    /// Returns an error when the underlying live ACP host cannot complete
    /// `session/set_config_option`.
    pub fn set_session_config_option(
        &mut self,
        session_id: &str,
        config_id: &str,
        value: &str,
    ) -> Result<SetSessionConfigOptionResponse> {
        tracing::debug!(
            event_name = "app_api.set_session_config_option",
            source = "app-api",
            session_id,
            config_id,
            value
        );
        self.host
            .set_session_config_option(session_id, config_id, value)
    }

    /// Responds to one pending interaction for an active prompt turn.
    ///
    /// # Errors
    ///
    /// Returns an error when the interaction is unknown, already resolved, or
    /// the response payload is invalid.
    pub fn respond_interaction(
        &self,
        session_id: &str,
        interaction_id: &str,
        response: InteractionResponse,
    ) -> Result<()> {
        self.host
            .respond_interaction(session_id, interaction_id, response)
    }

    /// Returns the current operation snapshot for proof tooling.
    #[must_use]
    pub fn operation_snapshot(&self) -> AppOperationSnapshot {
        AppOperationSnapshot {
            provider: self.host.snapshot(),
            raw_events: self.host.raw_events().to_vec(),
        }
    }

    /// Returns the outbound ACP envelopes captured so far.
    #[must_use]
    pub fn request_envelopes(&self) -> &[serde_json::Value] {
        self.host.request_envelopes()
    }

    /// Returns the inbound ACP responses captured so far.
    #[must_use]
    pub fn response_envelopes(&self) -> &[serde_json::Value] {
        self.host.response_envelopes()
    }
}

/// Returns the locked ACP method names exposed by the app API.
#[must_use]
pub const fn locked_methods() -> &'static [acp_contracts::LockedMethod] {
    &LOCKED_ACP_METHODS
}
