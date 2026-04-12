//! Versioned WebSocket envelopes for the consumer runtime API.

use serde::{Deserialize, Serialize};
use service_runtime::{ConsumerCommand, ConsumerError, ConsumerResponse};

const PROTOCOL_VERSION: u8 = 1;

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

#[derive(Debug, Serialize)]
pub(crate) struct ServerResponseFrame {
    v: u8,
    #[serde(rename = "type")]
    frame_type: &'static str,
    id: String,
    response: ConsumerResponse,
}

impl ServerResponseFrame {
    /// Creates one response frame.
    #[must_use]
    pub(crate) fn new(id: String, response: ConsumerResponse) -> Self {
        Self {
            v: PROTOCOL_VERSION,
            frame_type: "response",
            id,
            response,
        }
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct ServerEventFrame<T> {
    v: u8,
    #[serde(rename = "type")]
    frame_type: &'static str,
    event: T,
}

impl<T> ServerEventFrame<T> {
    /// Creates one event frame.
    #[must_use]
    pub(crate) fn new(event: T) -> Self {
        Self {
            v: PROTOCOL_VERSION,
            frame_type: "event",
            event,
        }
    }
}

fn validate_frame(frame: IncomingCommandFrame) -> ClientCommandFrame {
    if frame.v != PROTOCOL_VERSION {
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
    use super::ClientCommandFrame;
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
}
