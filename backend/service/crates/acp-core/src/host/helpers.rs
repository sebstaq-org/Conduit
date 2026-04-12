//! Shared helper functions for ACP host state.

use crate::error::AcpError;
use crate::snapshot::LiveSessionIdentity;
use acp_discovery::ProviderId;
use agent_client_protocol::{self as acp, SessionId};
use serde_json::Value;

pub(super) fn identity(provider: ProviderId, session_id: &SessionId) -> LiveSessionIdentity {
    LiveSessionIdentity {
        provider,
        acp_session_id: session_id.to_string(),
    }
}

pub(super) fn unexpected(provider: ProviderId, message: impl Into<String>) -> AcpError {
    AcpError::UnexpectedEnvelope {
        provider,
        message: message.into(),
    }
}

pub(super) fn session_update_variant(update: &acp::SessionUpdate, update_value: &Value) -> String {
    let variant = match update {
        acp::SessionUpdate::UserMessageChunk(_) => "user_message_chunk",
        acp::SessionUpdate::AgentMessageChunk(_) => "agent_message_chunk",
        acp::SessionUpdate::AgentThoughtChunk(_) => "agent_thought_chunk",
        acp::SessionUpdate::ToolCall(_) => "tool_call",
        acp::SessionUpdate::ToolCallUpdate(_) => "tool_call_update",
        acp::SessionUpdate::Plan(_) => "plan",
        acp::SessionUpdate::AvailableCommandsUpdate(_) => "available_commands_update",
        acp::SessionUpdate::CurrentModeUpdate(_) => "current_mode_update",
        acp::SessionUpdate::ConfigOptionUpdate(_) => "config_option_update",
        acp::SessionUpdate::SessionInfoUpdate(_) => "session_info_update",
        _ => update_value
            .get("sessionUpdate")
            .and_then(Value::as_str)
            .unwrap_or("unknown_session_update"),
    };
    variant.to_owned()
}
