//! Vendored ACP contract loading and locked-subset validation for Conduit.

#![forbid(unsafe_code)]
#![deny(
    missing_docs,
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::invalid_codeblock_attributes,
    rustdoc::invalid_rust_codeblocks,
    rustdoc::missing_crate_level_docs,
    rustdoc::private_intra_doc_links
)]

mod bundle;
mod error;
mod validate;

pub use bundle::{
    BundleMetadata, ContractBundle, UpstreamSource, VendorManifest, VendoredFile, VendoredFiles,
    load_contract_bundle, load_locked_contract_bundle, vendor_contract_root,
};
pub use error::{Error, Result};
pub use validate::{
    LOCKED_ACP_METHODS, LockedMethod, assert_locked_method_registration,
    validate_locked_cancel_notification, validate_locked_request_envelope,
    validate_locked_response_envelope,
};

#[cfg(test)]
mod tests {
    use super::{
        LOCKED_ACP_METHODS, LockedMethod, assert_locked_method_registration, load_contract_bundle,
        validate_locked_cancel_notification, validate_locked_request_envelope,
        validate_locked_response_envelope,
    };
    use crate::{Error, Result};
    use agent_client_protocol_schema::{
        AGENT_METHOD_NAMES, AgentResponse, AgentSide, CancelNotification, ClientRequest,
        ClientSide, Implementation, InitializeRequest, InitializeResponse, JsonRpcMessage,
        NewSessionRequest, NewSessionResponse, Notification, OutgoingMessage, PromptResponse,
        ProtocolVersion, Request, Response, SessionId, StopReason,
    };
    use serde_json::{json, to_value};
    use std::path::PathBuf;
    use std::sync::Arc;

    fn serialize_value<T>(value: T) -> Result<serde_json::Value>
    where
        T: serde::Serialize,
    {
        to_value(value).map_err(|error| Error::contract(error.to_string()))
    }

    #[test]
    fn bundle_loads_and_registers_locked_methods() -> Result<()> {
        let bundle = load_contract_bundle()?;
        assert_locked_method_registration(&bundle)?;
        if LOCKED_ACP_METHODS.len() != 6 {
            return Err(Error::contract(
                "locked ACP method count drifted from Phase 1",
            ));
        }
        Ok(())
    }

    #[test]
    fn rejects_drifted_agent_method_registry_shape() -> Result<()> {
        let mut bundle = load_contract_bundle()?;
        bundle.meta["agentMethods"]["session_new"] = json!("session/create");
        let error = assert_locked_method_registration(&bundle)
            .err()
            .ok_or_else(|| Error::contract("drifted session_new unexpectedly passed"))?;
        if !error.to_string().contains("session_new") {
            return Err(Error::contract(
                "drifted session_new error did not identify the key",
            ));
        }
        Ok(())
    }

    #[test]
    fn rejects_non_string_agent_method_values() -> Result<()> {
        let mut bundle = load_contract_bundle()?;
        bundle.meta["agentMethods"]["session_new"] = json!(true);
        let error = assert_locked_method_registration(&bundle)
            .err()
            .ok_or_else(|| Error::contract("non-string session_new unexpectedly passed"))?;
        if !error.to_string().contains("not a string") {
            return Err(Error::contract(
                "non-string session_new error did not identify the shape failure",
            ));
        }
        Ok(())
    }

    #[test]
    fn validates_initialize_request_and_response() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let request =
            JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Request(Request {
                id: 1.into(),
                method: Arc::from(AGENT_METHOD_NAMES.initialize),
                params: Some(ClientRequest::InitializeRequest(
                    InitializeRequest::new(ProtocolVersion::V1)
                        .client_info(Implementation::new("conduit-phase-1", "0.5.0")),
                )),
            }));
        let request_value = serialize_value(request)?;
        let method = validate_locked_request_envelope(&bundle, &request_value)?;
        if method != LockedMethod::Initialize {
            return Err(Error::contract(
                "initialize request validated as the wrong method",
            ));
        }

        let response = JsonRpcMessage::wrap(OutgoingMessage::<AgentSide, ClientSide>::Response(
            Response::Result {
                id: 1.into(),
                result: AgentResponse::InitializeResponse(
                    InitializeResponse::new(ProtocolVersion::V1)
                        .agent_info(Implementation::new("agent", "0.11.5")),
                ),
            },
        ));
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::Initialize, &response_value)?;
        Ok(())
    }

    #[test]
    fn validates_new_session_and_cancel_envelopes() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let new_session =
            JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Request(Request {
                id: 2.into(),
                method: Arc::from("session/new"),
                params: Some(ClientRequest::NewSessionRequest(NewSessionRequest::new(
                    PathBuf::from("/tmp"),
                ))),
            }));
        let new_session_value = serialize_value(new_session)?;
        let method = validate_locked_request_envelope(&bundle, &new_session_value)?;
        if method != LockedMethod::SessionNew {
            return Err(Error::contract(
                "session/new request validated as the wrong method",
            ));
        }

        let response = JsonRpcMessage::wrap(OutgoingMessage::<AgentSide, ClientSide>::Response(
            Response::Result {
                id: 2.into(),
                result: AgentResponse::NewSessionResponse(NewSessionResponse::new(SessionId::new(
                    "session-1",
                ))),
            },
        ));
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::SessionNew, &response_value)?;

        let cancel = JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Notification(
            Notification {
                method: Arc::from("session/cancel"),
                params: Some(
                    agent_client_protocol_schema::ClientNotification::CancelNotification(
                        CancelNotification::new(SessionId::new("session-1")),
                    ),
                ),
            },
        ));
        let cancel_value = serialize_value(cancel)?;
        validate_locked_cancel_notification(&bundle, &cancel_value)?;
        Ok(())
    }

    #[test]
    fn validates_prompt_response() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let response = JsonRpcMessage::wrap(OutgoingMessage::<AgentSide, ClientSide>::Response(
            Response::Result {
                id: 3.into(),
                result: AgentResponse::PromptResponse(PromptResponse::new(StopReason::EndTurn)),
            },
        ));
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::SessionPrompt, &response_value)?;
        Ok(())
    }
}
