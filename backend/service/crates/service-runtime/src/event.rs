//! Consumer-visible runtime events.

use acp_discovery::ProviderId;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    /// The UI-facing session timeline changed.
    SessionTimelineChanged,
    /// The UI-facing sessions index changed.
    SessionsIndexChanged,
}

#[derive(Default)]
pub(crate) struct EventBuffer {
    events: Vec<RuntimeEvent>,
    next_sequence: u64,
    sink: Option<Box<dyn FnMut(RuntimeEvent) + Send>>,
}

impl EventBuffer {
    pub(crate) fn new() -> Self {
        Self {
            events: Vec::new(),
            next_sequence: 1,
            sink: None,
        }
    }

    pub(crate) fn set_sink(&mut self, sink: Box<dyn FnMut(RuntimeEvent) + Send>) {
        self.sink = Some(sink);
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

    pub(crate) fn emit(
        &mut self,
        provider: ProviderId,
        kind: RuntimeEventKind,
        session_id: Option<String>,
        payload: Value,
    ) {
        let sequence = self.next_sequence;
        self.next_sequence += 1;
        let event = RuntimeEvent {
            sequence,
            kind,
            provider,
            session_id,
            payload,
        };
        self.events.push(event.clone());
        if let Some(sink) = self.sink.as_mut() {
            sink(event);
        }
    }
}
