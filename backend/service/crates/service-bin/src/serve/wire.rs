//! Versioned WebSocket envelopes for the consumer runtime API.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use service_runtime::contracts::{
    ClientCommandFrame as WireClientCommandFrame, ConsumerCommand as WireConsumerCommand,
    RuntimeEvent as WireRuntimeEvent, ServerEventFrame as WireServerEventFrame,
    ServerEventFrameType, ServerResponseFrame as WireServerResponseFrame, ServerResponseFrameType,
    validate_contract_value,
};
use service_runtime::{ConsumerCommand, ConsumerError, ConsumerResponse};

const PROTOCOL_VERSION: u8 = 1;

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
        let frame_value = match serde_json::from_str::<Value>(text) {
            Ok(frame) => frame,
            Err(error) => return invalid("invalid-frame", &error.to_string()),
        };
        let id = frame_id(&frame_value);
        if let Err(error) = validate_contract_value("ClientCommandFrame", &frame_value) {
            return invalid(&id, &error.to_string());
        }
        match serde_json::from_value::<WireClientCommandFrame>(frame_value) {
            Ok(frame) => accept_frame(frame),
            Err(error) => invalid(&id, &format!("invalid frame payload: {error}")),
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

/// Builds one response frame owned by the generated product contract.
pub(crate) fn server_response_frame(
    id: String,
    response: ConsumerResponse,
) -> Result<WireServerResponseFrame, serde_json::Error> {
    Ok(WireServerResponseFrame {
        v: PROTOCOL_VERSION,
        frame_type: ServerResponseFrameType::Value,
        id,
        response: convert_contract_shape(response)?,
    })
}

/// Builds one event frame owned by the generated product contract.
#[must_use]
pub(crate) fn server_event_frame(event: WireRuntimeEvent) -> WireServerEventFrame {
    WireServerEventFrame {
        v: PROTOCOL_VERSION,
        frame_type: ServerEventFrameType::Value,
        event,
    }
}

fn accept_frame(frame: WireClientCommandFrame) -> ClientCommandFrame {
    let command = match into_runtime_command(frame.id.clone(), frame.command) {
        Ok(command) => command,
        Err(message) => return invalid(&frame.id, &message),
    };
    ClientCommandFrame {
        id: frame.id,
        command: Some(command),
        rejection: None,
    }
}

fn frame_id(value: &Value) -> String {
    value
        .as_object()
        .and_then(|object| object.get("id"))
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .unwrap_or("invalid-frame")
        .to_owned()
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

fn into_runtime_command(
    frame_id: String,
    command: WireConsumerCommand,
) -> Result<ConsumerCommand, String> {
    let mut runtime_command: ConsumerCommand = convert_contract_shape(command)
        .map_err(|error| format!("invalid command payload: {error}"))?;
    runtime_command.id = frame_id;
    Ok(runtime_command)
}

fn convert_contract_shape<Input, Output>(value: Input) -> Result<Output, serde_json::Error>
where
    Input: Serialize,
    Output: for<'de> Deserialize<'de>,
{
    serde_json::from_value(serde_json::to_value(value)?)
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
        let Some(rejection) = frame.rejection() else {
            return Err("missing transport rejection".into());
        };
        if rejection.id != "wire-2" {
            return Err(format!("unexpected rejection id {}", rejection.id).into());
        }
        Ok(())
    }

    #[test]
    fn unsupported_frame_type_is_rejected_before_runtime_dispatch() -> TestResult<()> {
        let frame = ClientCommandFrame::from_text(
            r#"{
                "v": 1,
                "type": "event",
                "id": "wire-3",
                "command": {
                    "id": "wire-3",
                    "command": "sessions/watch",
                    "provider": "all",
                    "params": {}
                }
            }"#,
        );

        if frame.rejection().is_none() {
            return Err("missing transport rejection".into());
        }
        Ok(())
    }

    #[test]
    fn invalid_frame_without_correlation_uses_invalid_frame_id() -> TestResult<()> {
        let frame = ClientCommandFrame::from_text(
            r#"{
                "v": 1,
                "type": "command",
                "command": {
                    "id": "wire-4",
                    "command": "sessions/watch",
                    "provider": "all",
                    "params": {}
                }
            }"#,
        );

        let Some(rejection) = frame.rejection() else {
            return Err("missing transport rejection".into());
        };
        if rejection.id != "invalid-frame" {
            return Err(format!("unexpected rejection id {}", rejection.id).into());
        }
        Ok(())
    }
}
