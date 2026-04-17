//! Provider runtime ports used by the consumer manager.

use crate::Result;
use acp_core::{
    InteractionResponse, ProviderInitializeRequest, ProviderInitializeResult, ProviderSnapshot,
    RawWireEvent, TranscriptUpdateSnapshot,
};
use acp_discovery::ProviderId;
use serde_json::Value;
use std::path::PathBuf;

/// Factory for connecting provider runtimes.
pub trait ProviderFactory: Send {
    /// Connects one provider runtime.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider runtime cannot be connected.
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>>;
}

/// One provider runtime managed by `service-runtime`.
pub trait ProviderPort: Send {
    /// Runs ACP `initialize` for the provider runtime.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider runtime cannot be initialized.
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult>;

    /// Returns the completed ACP `initialize` exchange when available.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider runtime cannot answer the request.
    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>>;

    /// Returns the current read-side provider snapshot.
    fn snapshot(&self) -> ProviderSnapshot;

    /// Returns raw wire events captured by the provider runtime.
    fn raw_events(&self) -> Vec<RawWireEvent>;

    /// Disconnects the provider runtime.
    ///
    /// # Errors
    ///
    /// Returns an error when disconnect cannot be sent to the provider runtime.
    fn disconnect(&mut self) -> Result<()>;

    /// Runs ACP `session/new`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_new(&mut self, cwd: PathBuf) -> Result<Value>;

    /// Runs ACP `session/list`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_list(&mut self, cwd: Option<PathBuf>, cursor: Option<String>) -> Result<Value>;

    /// Runs ACP `session/load`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_load(&mut self, session_id: String, cwd: PathBuf) -> Result<Value>;

    /// Runs ACP `session/prompt`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_prompt(
        &mut self,
        session_id: String,
        prompt: Vec<Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<Value>;

    /// Runs ACP `session/cancel`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_cancel(&mut self, session_id: String) -> Result<Value>;

    /// Runs ACP `session/set_config_option`.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider rejects or fails the command.
    fn session_set_config_option(
        &mut self,
        session_id: String,
        config_id: String,
        value: String,
    ) -> Result<Value>;

    /// Runs one out-of-band interaction response while a prompt is active.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider runtime does not support the command
    /// or the interaction response is rejected.
    fn session_respond_interaction(
        &mut self,
        session_id: String,
        interaction_id: String,
        response: InteractionResponse,
    ) -> Result<Value> {
        let _unused = (session_id, interaction_id, response);
        Err(crate::RuntimeError::UnsupportedCommand(
            "session/respond_interaction".to_owned(),
        ))
    }
}
