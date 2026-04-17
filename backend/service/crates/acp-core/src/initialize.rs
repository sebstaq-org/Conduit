//! Explicit ACP `initialize` lifecycle contract.

use agent_client_protocol as acp;
use serde::{Deserialize, Serialize};

/// The official ACP method name used to initialize a provider connection.
pub const INITIALIZE_METHOD: &str = "initialize";

/// Conduit's first-class request model for ACP `initialize`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInitializeRequest {
    /// The ACP method represented by this lifecycle request.
    pub method: String,
    /// The latest protocol version supported by Conduit.
    pub protocol_version: acp::ProtocolVersion,
    /// Capabilities supported by the Conduit client side.
    pub client_capabilities: acp::ClientCapabilities,
    /// Implementation information reported to the provider.
    pub client_info: acp::Implementation,
}

impl ProviderInitializeRequest {
    /// Creates Conduit's default ACP `initialize` request.
    #[must_use]
    pub fn conduit_default() -> Self {
        Self {
            method: INITIALIZE_METHOD.to_owned(),
            protocol_version: acp::ProtocolVersion::LATEST,
            client_capabilities: acp::ClientCapabilities::default(),
            client_info: acp::Implementation::new("conduit", env!("CARGO_PKG_VERSION"))
                .title("Conduit"),
        }
    }

    pub(crate) fn to_sdk_request(&self) -> acp::InitializeRequest {
        acp::InitializeRequest::new(self.protocol_version.clone())
            .client_capabilities(self.client_capabilities.clone())
            .client_info(self.client_info.clone())
    }
}

/// Conduit's first-class response model for ACP `initialize`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInitializeResponse {
    /// The protocol version chosen by the provider.
    pub protocol_version: acp::ProtocolVersion,
    /// Capabilities supported by the provider.
    pub agent_capabilities: acp::AgentCapabilities,
    /// Implementation information reported by the provider.
    pub agent_info: Option<acp::Implementation>,
    /// Authentication methods supported by the provider.
    pub auth_methods: Vec<acp::AuthMethod>,
}

impl ProviderInitializeResponse {
    pub(crate) fn from_sdk_response(response: acp::InitializeResponse) -> Self {
        Self {
            protocol_version: response.protocol_version,
            agent_capabilities: response.agent_capabilities,
            agent_info: response.agent_info,
            auth_methods: response.auth_methods,
        }
    }
}

/// Completed ACP `initialize` exchange for one provider connection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderInitializeResult {
    /// Request sent by Conduit.
    pub request: ProviderInitializeRequest,
    /// Response returned by the provider.
    pub response: ProviderInitializeResponse,
}
