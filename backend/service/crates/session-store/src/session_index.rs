//! Session index read-model primitives.

use acp_discovery::ProviderId;
use serde::{Deserialize, Serialize};

/// One indexed ACP session for Conduit's session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexEntry {
    /// Provider that owns the ACP session.
    pub provider: ProviderId,
    /// Provider-issued ACP session id.
    pub session_id: String,
    /// Absolute cwd associated with the session.
    pub cwd: String,
    /// Provider-reported display title.
    pub title: Option<String>,
    /// Provider-reported last activity timestamp.
    pub updated_at: Option<String>,
}

/// Current indexed sessions plus index metadata.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionIndexSnapshot {
    /// Index revision. Increments when indexed session rows change.
    pub revision: i64,
    /// Last completed provider refresh timestamp for any indexed provider.
    pub refreshed_at: Option<String>,
    /// Indexed session rows.
    pub entries: Vec<SessionIndexEntry>,
}

impl SessionIndexEntry {
    pub(crate) fn sort_key(&self) -> (&str, &str, &str) {
        (self.provider.as_str(), &self.cwd, &self.session_id)
    }
}
