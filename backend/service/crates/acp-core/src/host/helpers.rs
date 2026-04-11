//! Shared helper functions for ACP host state.

use crate::error::AcpError;
use crate::snapshot::LiveSessionIdentity;
use acp_discovery::ProviderId;
use agent_client_protocol::SessionId;

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
