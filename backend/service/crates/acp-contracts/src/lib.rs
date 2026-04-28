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
        ContractBundle, LOCKED_ACP_METHODS, LockedMethod, assert_locked_method_registration,
        load_contract_bundle, validate_locked_cancel_notification,
        validate_locked_request_envelope, validate_locked_response_envelope,
    };
    use crate::{Error, Result};
    use agent_client_protocol_schema::{
        AGENT_METHOD_NAMES, AgentResponse, CancelNotification, ClientNotification, ClientRequest,
        Implementation, InitializeRequest, InitializeResponse, JsonRpcMessage, LoadSessionRequest,
        LoadSessionResponse, NewSessionRequest, NewSessionResponse, Notification, PromptResponse,
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
        if LOCKED_ACP_METHODS.len() != 7 {
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
        let request = JsonRpcMessage::wrap(Request {
            id: 1.into(),
            method: Arc::from(AGENT_METHOD_NAMES.initialize),
            params: Some(ClientRequest::InitializeRequest(
                InitializeRequest::new(ProtocolVersion::V1)
                    .client_info(Implementation::new("conduit-phase-1", "0.5.0")),
            )),
        });
        let request_value = serialize_value(request)?;
        let method = validate_locked_request_envelope(&bundle, &request_value)?;
        if method != LockedMethod::Initialize {
            return Err(Error::contract(
                "initialize request validated as the wrong method",
            ));
        }

        let response = JsonRpcMessage::wrap(Response::Result {
            id: 1.into(),
            result: AgentResponse::InitializeResponse(
                InitializeResponse::new(ProtocolVersion::V1)
                    .agent_info(Implementation::new("agent", "0.12.0")),
            ),
        });
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::Initialize, &response_value)?;
        Ok(())
    }

    #[test]
    fn validates_new_session_and_cancel_envelopes() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let new_session = JsonRpcMessage::wrap(Request {
            id: 2.into(),
            method: Arc::from("session/new"),
            params: Some(ClientRequest::NewSessionRequest(NewSessionRequest::new(
                PathBuf::from("/tmp"),
            ))),
        });
        let new_session_value = serialize_value(new_session)?;
        let method = validate_locked_request_envelope(&bundle, &new_session_value)?;
        if method != LockedMethod::SessionNew {
            return Err(Error::contract(
                "session/new request validated as the wrong method",
            ));
        }

        let response = JsonRpcMessage::wrap(Response::Result {
            id: 2.into(),
            result: AgentResponse::NewSessionResponse(NewSessionResponse::new(SessionId::new(
                "session-1",
            ))),
        });
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::SessionNew, &response_value)?;

        let cancel = JsonRpcMessage::wrap(Notification {
            method: Arc::from("session/cancel"),
            params: Some(ClientNotification::CancelNotification(
                CancelNotification::new(SessionId::new("session-1")),
            )),
        });
        let cancel_value = serialize_value(cancel)?;
        validate_locked_cancel_notification(&bundle, &cancel_value)?;
        Ok(())
    }

    #[test]
    fn validates_load_session_request_and_object_response() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let request_value = serialize_value(load_session_request(PathBuf::from("/tmp")))?;
        let method = validate_locked_request_envelope(&bundle, &request_value)?;
        if method != LockedMethod::SessionLoad {
            return Err(Error::contract(
                "session/load request validated as the wrong method",
            ));
        }

        assert_load_session_request_rejects(&bundle, load_without_mcp_servers(), "mcpServers")?;
        assert_load_session_request_rejects(&bundle, load_with_relative_cwd(), "absolute")?;

        let response_value = serialize_value(load_session_response())?;
        validate_locked_response_envelope(&bundle, LockedMethod::SessionLoad, &response_value)?;
        Ok(())
    }

    fn load_session_request(cwd: PathBuf) -> JsonRpcMessage<Request<ClientRequest>> {
        JsonRpcMessage::wrap(Request {
            id: 3.into(),
            method: Arc::from("session/load"),
            params: Some(ClientRequest::LoadSessionRequest(LoadSessionRequest::new(
                SessionId::new("session-1"),
                cwd,
            ))),
        })
    }

    fn load_session_response() -> JsonRpcMessage<Response<AgentResponse>> {
        JsonRpcMessage::wrap(Response::Result {
            id: 3.into(),
            result: AgentResponse::LoadSessionResponse(LoadSessionResponse::new()),
        })
    }

    fn load_without_mcp_servers() -> serde_json::Value {
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "session/load",
            "params": {
                "sessionId": "session-1",
                "cwd": "/tmp"
            }
        })
    }

    fn load_with_relative_cwd() -> serde_json::Value {
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "session/load",
            "params": {
                "sessionId": "session-1",
                "cwd": "relative",
                "mcpServers": []
            }
        })
    }

    fn assert_load_session_request_rejects(
        bundle: &ContractBundle,
        request: serde_json::Value,
        expected_message: &str,
    ) -> Result<()> {
        let error = validate_locked_request_envelope(bundle, &request)
            .err()
            .ok_or_else(|| Error::contract("invalid session/load request passed"))?;
        if error.to_string().contains(expected_message) {
            return Ok(());
        }
        Err(Error::contract(format!(
            "session/load error did not identify {expected_message}"
        )))
    }

    #[test]
    fn validates_prompt_response() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let response = JsonRpcMessage::wrap(Response::Result {
            id: 3.into(),
            result: AgentResponse::PromptResponse(PromptResponse::new(StopReason::EndTurn)),
        });
        let response_value = serialize_value(response)?;
        validate_locked_response_envelope(&bundle, LockedMethod::SessionPrompt, &response_value)?;
        Ok(())
    }

    #[test]
    fn validates_set_session_config_option_request_and_response() -> Result<()> {
        let bundle = load_contract_bundle()?;
        let request = json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "session/set_config_option",
            "params": {
                "sessionId": "session-1",
                "configId": "model",
                "value": "gpt-5.4"
            }
        });
        let method = validate_locked_request_envelope(&bundle, &request)?;
        if method != LockedMethod::SessionSetConfigOption {
            return Err(Error::contract(
                "session/set_config_option request validated as the wrong method",
            ));
        }

        let response = json!({
            "jsonrpc": "2.0",
            "id": 7,
            "result": {
                "configOptions": [{
                    "id": "model",
                    "name": "Model",
                    "type": "select",
                    "currentValue": "gpt-5.4",
                    "options": [{
                        "value": "gpt-5.4",
                        "name": "GPT-5.4"
                    }]
                }]
            }
        });
        validate_locked_response_envelope(
            &bundle,
            LockedMethod::SessionSetConfigOption,
            &response,
        )?;
        Ok(())
    }
}
