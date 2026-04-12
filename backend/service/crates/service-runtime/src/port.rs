//! Provider runtime ports used by the consumer manager.

use crate::Result;
use acp_core::{ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot};
use acp_discovery::ProviderId;
use serde_json::Value;
use std::path::PathBuf;

/// Factory for connecting provider runtimes.
pub trait ProviderFactory: Send {
    /// Connects and initializes one provider runtime.
    ///
    /// # Errors
    ///
    /// Returns an error when the provider runtime cannot be initialized.
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>>;
}

/// One initialized provider runtime managed by `service-runtime`.
pub trait ProviderPort: Send {
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
}
