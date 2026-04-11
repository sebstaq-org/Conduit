//! Consumer-visible runtime events.

use crate::Result;
use acp_core::RawWireEvent;
use acp_discovery::ProviderId;
use serde::{Deserialize, Serialize};
use serde_json::{Value, to_value};
use std::collections::HashMap;

/// One consumer-visible runtime event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeEvent {
    /// Monotonic runtime-local event sequence.
    pub sequence: u64,
    /// Event kind.
    pub kind: RuntimeEventKind,
    /// Provider that produced or owns the event.
    pub provider: ProviderId,
    /// ACP session id when the event is session-scoped.
    pub session_id: Option<String>,
    /// Raw or read-side payload for the event.
    pub payload: Value,
}

/// Runtime event kind.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeEventKind {
    /// A provider runtime was initialized and connected.
    ProviderConnected,
    /// A provider runtime was disconnected.
    ProviderDisconnected,
    /// A session was observed through an ACP command.
    SessionObserved,
    /// A replayed load-time `session/update` was exposed to consumers.
    SessionReplayUpdate,
    /// A prompt command started.
    PromptStarted,
    /// A prompt update was observed.
    PromptUpdateObserved,
    /// A prompt command completed.
    PromptCompleted,
    /// The UI-facing session timeline changed.
    SessionTimelineChanged,
    /// A cancel command was sent.
    CancelSent,
    /// A raw wire event was captured for debug/proof consumers.
    RawWireEventCaptured,
}

#[derive(Debug, Default)]
pub(crate) struct EventBuffer {
    events: Vec<RuntimeEvent>,
    next_sequence: u64,
    raw_event_offsets: HashMap<ProviderId, usize>,
}

impl EventBuffer {
    pub(crate) fn new() -> Self {
        Self {
            events: Vec::new(),
            next_sequence: 1,
            raw_event_offsets: HashMap::new(),
        }
    }

    pub(crate) fn events_after(&self, sequence: u64) -> Vec<RuntimeEvent> {
        self.events
            .iter()
            .filter(|event| event.sequence > sequence)
            .cloned()
            .collect()
    }

    pub(crate) fn latest_sequence(&self) -> u64 {
        self.next_sequence.saturating_sub(1)
    }

    pub(crate) fn drain(&mut self) -> Vec<RuntimeEvent> {
        std::mem::take(&mut self.events)
    }

    pub(crate) fn capture_raw_events(
        &mut self,
        provider: ProviderId,
        raw_events: &[RawWireEvent],
    ) -> Result<()> {
        let offset = self.raw_event_offsets.get(&provider).copied().unwrap_or(0);
        for event in raw_events.iter().skip(offset) {
            self.emit(
                provider,
                RuntimeEventKind::RawWireEventCaptured,
                None,
                to_value(event)?,
            );
        }
        self.raw_event_offsets.insert(provider, raw_events.len());
        Ok(())
    }

    pub(crate) fn emit(
        &mut self,
        provider: ProviderId,
        kind: RuntimeEventKind,
        session_id: Option<String>,
        payload: Value,
    ) {
        let sequence = self.next_sequence;
        self.next_sequence += 1;
        self.events.push(RuntimeEvent {
            sequence,
            kind,
            provider,
            session_id,
            payload,
        });
    }
}
