//! Normalized Conduit snapshots layered over raw ACP truth.

use acp_discovery::{ProviderDiscovery, ProviderId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The current host connection state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    /// The provider process has not been started.
    Disconnected,
    /// The provider process is live and initialized.
    Ready,
}

/// The exact live session identity rule for Conduit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiveSessionIdentity {
    /// The provider owning this session.
    pub provider: ProviderId,
    /// The ACP session id returned by the provider.
    pub acp_session_id: String,
}

/// A normalized live session snapshot anchored to ACP truth.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiveSessionSnapshot {
    /// The exact live identity.
    pub identity: LiveSessionIdentity,
    /// The provider-reported or Conduit-observed working directory.
    pub cwd: String,
    /// The provider-reported title when available.
    pub title: Option<String>,
    /// Whether the session was observed via `new`, `list`, or `load`.
    pub observed_via: String,
}

/// The normalized prompt lifecycle state for a single session turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptLifecycleState {
    /// No active prompt turn is being tracked.
    Idle,
    /// A prompt request is in flight.
    Running,
    /// The prompt returned successfully.
    Completed,
    /// The prompt completed after a cancel notification.
    Cancelled,
}

/// A normalized prompt lifecycle snapshot backed by raw ACP updates.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PromptLifecycleSnapshot {
    /// The session the prompt belongs to.
    pub identity: LiveSessionIdentity,
    /// The current lifecycle state.
    pub state: PromptLifecycleState,
    /// The ACP stop reason when available.
    pub stop_reason: Option<String>,
    /// The number of raw session/update notifications observed during the turn.
    pub raw_update_count: usize,
    /// Agent-authored text chunks observed through official SDK notifications.
    #[serde(default)]
    pub agent_text_chunks: Vec<String>,
}

/// One replayed `session/update` captured during `session/load`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TranscriptUpdateSnapshot {
    /// Zero-based replay order within the loaded transcript.
    pub index: usize,
    /// Official ACP `SessionUpdate` discriminator value when known.
    pub variant: String,
    /// The structurally serialized official ACP update payload.
    pub update: Value,
}

/// Read-side transcript replay captured while loading a session.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LoadedTranscriptSnapshot {
    /// The loaded session identity.
    pub identity: LiveSessionIdentity,
    /// The number of official SDK notifications observed during load.
    pub raw_update_count: usize,
    /// Replayed updates in provider emission order.
    #[serde(default)]
    pub updates: Vec<TranscriptUpdateSnapshot>,
}

/// The current provider snapshot exposed to apps and proof tooling.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderSnapshot {
    /// The provider identifier.
    pub provider: ProviderId,
    /// The current connection state.
    pub connection_state: ConnectionState,
    /// The locked launcher truth and initialize probe provenance.
    pub discovery: ProviderDiscovery,
    /// The provider-reported capabilities from the live initialize result.
    pub capabilities: Value,
    /// The provider-reported auth methods from the live initialize result.
    pub auth_methods: Vec<Value>,
    /// The live sessions currently tracked in memory.
    pub live_sessions: Vec<LiveSessionSnapshot>,
    /// The last observed prompt lifecycle, if any.
    pub last_prompt: Option<PromptLifecycleSnapshot>,
    /// Transcript replays captured during `session/load`.
    #[serde(default)]
    pub loaded_transcripts: Vec<LoadedTranscriptSnapshot>,
}
