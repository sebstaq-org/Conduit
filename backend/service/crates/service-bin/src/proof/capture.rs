//! Scenario capture aggregation and artifact writing.

use crate::artifact::{ScenarioArtifact, write_scenario_artifacts};
use crate::error::Result;
use acp_core::{ProviderSnapshot, RawWireEvent};
use app_api::AppService;
use serde_json::Value;

use super::isolation::verify_capture;
use super::workspace::ProofWorkspace;

/// One captured service state that can be merged into a scenario artifact.
pub(crate) struct ScenarioCapture {
    /// The final provider snapshot for this captured connection.
    pub snapshot: ProviderSnapshot,
    /// The raw wire events captured on this connection.
    pub raw_events: Vec<RawWireEvent>,
    /// The outbound ACP envelopes captured on this connection.
    pub requests: Vec<Value>,
    /// The inbound ACP envelopes captured on this connection.
    pub responses: Vec<Value>,
}

impl ScenarioCapture {
    /// Captures one app-service connection into a mergeable scenario payload.
    #[must_use]
    pub(crate) fn from_service(service: AppService) -> Self {
        let snapshot = service.operation_snapshot();
        Self {
            snapshot: snapshot.provider,
            raw_events: snapshot.raw_events,
            requests: service.request_envelopes().to_vec(),
            responses: service.response_envelopes().to_vec(),
        }
    }

    /// Merges multiple captured connections into one final scenario payload.
    ///
    /// # Errors
    ///
    /// Returns an error when no captures were supplied.
    pub(crate) fn merge(captures: Vec<Self>) -> Result<Self> {
        let mut captures = captures.into_iter();
        let Some(mut merged) = captures.next() else {
            return Err(crate::error::ServiceError::InvalidCapture {
                message: "cannot merge an empty scenario capture set".to_owned(),
            });
        };
        for capture in captures {
            merged.snapshot = capture.snapshot;
            merged.raw_events.extend(capture.raw_events);
            merged.requests.extend(capture.requests);
            merged.responses.extend(capture.responses);
        }
        Ok(merged)
    }
}

/// Writes one isolated scenario artifact set after validating path isolation.
///
/// # Errors
///
/// Returns an error when the capture leaks absolute paths outside the proof
/// workspace or when artifact files cannot be written.
pub(crate) fn write_capture(
    command: &str,
    label: &str,
    details: &str,
    proof: &ProofWorkspace,
    capture: &ScenarioCapture,
) -> Result<()> {
    verify_capture(label, proof, capture)?;
    let summary = format!(
        "# {label}\n\n{}\n{}\nConnection: `{:?}`\n\nLive sessions: `{}`\n",
        proof.summary_lines(),
        details,
        capture.snapshot.connection_state,
        capture.snapshot.live_sessions.len()
    );
    write_scenario_artifacts(
        proof.artifact_root(),
        ScenarioArtifact {
            command,
            summary: &summary,
            snapshot: &capture.snapshot,
            requests: &capture.requests,
            responses: &capture.responses,
            events: &capture.raw_events,
        },
    )
}
