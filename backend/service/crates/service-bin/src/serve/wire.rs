//! Versioned WebSocket envelopes for the consumer runtime API.

use serde::Deserialize;
use service_runtime::consumer_protocol::{
    CONDUIT_TRANSPORT_VERSION, ConduitRuntimeEvent, ConduitServerEventFrame,
    ConduitServerResponseFrame,
};
use service_runtime::{ConsumerCommand, ConsumerError, ConsumerResponse};

#[derive(Debug, Deserialize)]
struct IncomingCommandFrame {
    v: u8,
    #[serde(rename = "type")]
    frame_type: String,
    id: String,
    command: ConsumerCommand,
}

/// Parsed or rejected client command frame.
pub(crate) struct ClientCommandFrame {
    id: String,
    command: Option<ConsumerCommand>,
    rejection: Option<ConsumerResponse>,
}

impl ClientCommandFrame {
    /// Parses a client frame, preserving correlation even on validation errors.
    #[must_use]
    pub(crate) fn from_text(text: &str) -> Self {
        match serde_json::from_str::<IncomingCommandFrame>(text) {
            Ok(frame) => validate_frame(frame),
            Err(error) => invalid("invalid-frame", &error.to_string()),
        }
    }

    /// Returns the frame id.
    pub(crate) fn id(&self) -> String {
        self.id.clone()
    }

    /// Returns the command name.
    pub(crate) fn command_name(&self) -> &str {
        self.command
            .as_ref()
            .map(|command| command.command.as_str())
            .unwrap_or("__invalid_frame__")
    }

    /// Returns the command to dispatch.
    pub(crate) fn command(&self) -> ConsumerCommand {
        self.command
            .clone()
            .unwrap_or_else(|| invalid_command(&self.id))
    }

    /// Returns a rejection response when the frame failed transport validation.
    pub(crate) fn rejection(&self) -> Option<ConsumerResponse> {
        self.rejection.clone()
    }
}

/// Serializes one backend-owned consumer response frame.
pub(crate) fn server_response_frame_text(
    id: String,
    response: ConsumerResponse,
) -> serde_json::Result<String> {
    let frame = ConduitServerResponseFrame::from_runtime_response(id, response)?;
    serde_json::to_string(&frame)
}

/// Serializes one backend-owned consumer event frame.
pub(crate) fn server_event_frame_text(event: ConduitRuntimeEvent) -> serde_json::Result<String> {
    serde_json::to_string(&ConduitServerEventFrame::new(event))
}

fn validate_frame(frame: IncomingCommandFrame) -> ClientCommandFrame {
    if frame.v != CONDUIT_TRANSPORT_VERSION {
        return invalid(&frame.id, "unsupported protocol version");
    }
    if frame.frame_type != "command" {
        return invalid(&frame.id, "unsupported frame type");
    }
    if frame.id.is_empty() {
        return invalid("invalid-frame", "frame id must be non-empty");
    }
    ClientCommandFrame {
        id: frame.id.clone(),
        command: Some(ConsumerCommand {
            id: frame.id,
            command: frame.command.command,
            provider: frame.command.provider,
            params: frame.command.params,
        }),
        rejection: None,
    }
}

fn invalid(id: &str, message: &str) -> ClientCommandFrame {
    ClientCommandFrame {
        id: id.to_owned(),
        command: None,
        rejection: Some(ConsumerResponse {
            id: id.to_owned(),
            ok: false,
            result: serde_json::Value::Null,
            error: Some(ConsumerError {
                code: "invalid_frame".to_owned(),
                message: message.to_owned(),
            }),
            snapshot: None,
        }),
    }
}

fn invalid_command(id: &str) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: "__invalid_frame__".to_owned(),
        provider: "codex".to_owned(),
        params: serde_json::Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::{ClientCommandFrame, server_event_frame_text, server_response_frame_text};
    use service_runtime::ConsumerResponse;
    use service_runtime::consumer_protocol::{ConduitRuntimeEvent, ConduitServerFrame};
    use std::error::Error;

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[test]
    fn command_frame_requires_protocol_version_and_correlation_id() -> TestResult<()> {
        let frame = ClientCommandFrame::from_text(
            r#"{
                "v": 1,
                "type": "command",
                "id": "wire-1",
                "command": {
                    "id": "caller-id",
                    "command": "sessions/watch",
                    "provider": "all",
                    "params": {}
                }
            }"#,
        );

        if frame.id() != "wire-1" {
            return Err(format!("unexpected frame id {}", frame.id()).into());
        }
        if frame.command().id != "wire-1" {
            return Err(format!("unexpected command id {}", frame.command().id).into());
        }
        Ok(())
    }

    #[test]
    fn unsupported_version_is_rejected_before_runtime_dispatch() -> TestResult<()> {
        let frame = ClientCommandFrame::from_text(
            r#"{
                "v": 2,
                "type": "command",
                "id": "wire-2",
                "command": {
                    "id": "wire-2",
                    "command": "sessions/watch",
                    "provider": "all",
                    "params": {}
                }
            }"#,
        );

        if frame.command_name() != "__invalid_frame__" {
            return Err(format!("unexpected command {}", frame.command_name()).into());
        }
        if frame.rejection().is_none() {
            return Err("missing transport rejection".into());
        }
        Ok(())
    }

    #[test]
    fn response_frame_text_uses_generated_consumer_frame_contract() -> TestResult<()> {
        let text = server_response_frame_text(
            "wire-1".to_owned(),
            ConsumerResponse {
                id: "wire-1".to_owned(),
                ok: true,
                result: serde_json::json!({ "subscribed": true }),
                error: None,
                snapshot: None,
            },
        )?;
        let frame: ConduitServerFrame = serde_json::from_str(&text)?;

        if serde_json::to_value(frame)?
            == serde_json::json!({
                "v": 1,
                "type": "response",
                "id": "wire-1",
                "response": {
                    "id": "wire-1",
                    "ok": true,
                    "result": { "subscribed": true },
                    "error": null,
                    "snapshot": null
                }
            })
        {
            return Ok(());
        }
        Err("response frame did not match generated consumer contract".into())
    }

    #[test]
    fn event_frame_text_uses_generated_consumer_frame_contract() -> TestResult<()> {
        let text =
            server_event_frame_text(ConduitRuntimeEvent::SessionsIndexChanged { revision: 4 })?;
        let frame: ConduitServerFrame = serde_json::from_str(&text)?;

        if serde_json::to_value(frame)?
            == serde_json::json!({
                "v": 1,
                "type": "event",
                "event": {
                    "kind": "sessions_index_changed",
                    "revision": 4
                }
            })
        {
            return Ok(());
        }
        Err("event frame did not match generated consumer contract".into())
    }

    #[test]
    fn timeline_event_frame_text_accepts_transcript_items() -> TestResult<()> {
        let event: ConduitRuntimeEvent = serde_json::from_value(serde_json::json!({
            "kind": "session_timeline_changed",
            "openSessionId": "open-session-1",
            "revision": 5,
            "items": [{
                "kind": "message",
                "id": "item-1",
                "role": "agent",
                "content": [{ "type": "text", "text": "hello" }]
            }]
        }))?;
        let text = server_event_frame_text(event)?;
        let frame: ConduitServerFrame = serde_json::from_str(&text)?;

        if serde_json::to_value(frame)?
            == serde_json::json!({
                "v": 1,
                "type": "event",
                "event": {
                    "kind": "session_timeline_changed",
                    "openSessionId": "open-session-1",
                    "revision": 5,
                    "items": [{
                        "kind": "message",
                        "id": "item-1",
                        "role": "agent",
                        "content": [{ "type": "text", "text": "hello" }]
                    }]
                }
            })
        {
            return Ok(());
        }
        Err("timeline event frame did not match generated consumer contract".into())
    }
}
