//! Internal transport and envelope helpers for the live ACP host.

use super::AcpHost;
use super::helpers::{decode_result, identity, stop_reason_string, unexpected};
use crate::error::{AcpError, Result};
use crate::snapshot::{PromptLifecycleSnapshot, PromptLifecycleState};
use crate::wire::{RawWireEvent, WireStream};
use acp_contracts::{LockedMethod, validate_locked_request_envelope};
use agent_client_protocol_schema::{
    AGENT_METHOD_NAMES, AgentSide, ClientRequest, ClientSide, ContentBlock, Error,
    InitializeRequest, InitializeResponse, JsonRpcMessage, OutgoingMessage, PromptRequest,
    PromptResponse, ProtocolVersion, Request, RequestId, Response, SessionId,
};
use serde::de::DeserializeOwned;
use serde_json::{Value, json, to_string, to_value};
use std::sync::Arc;
use std::time::{Duration, Instant};

impl AcpHost {
    pub(super) fn initialize(&mut self) -> Result<InitializeResponse> {
        let request = ClientRequest::InitializeRequest(InitializeRequest::new(ProtocolVersion::V1));
        self.round_trip("initialize", request, LockedMethod::Initialize)
    }

    pub(super) fn round_trip<T>(
        &mut self,
        method: &str,
        params: ClientRequest,
        locked: LockedMethod,
    ) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let request_id = self.allocate_request_id();
        let envelope =
            JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Request(Request {
                id: request_id.clone(),
                method: Arc::from(method),
                params: Some(params),
            }));
        let value =
            to_value(&envelope).map_err(|error| unexpected(self.provider, error.to_string()))?;
        validate_locked_request_envelope(&self.contract_bundle, &value)?;
        self.send_json(method, &value)?;
        let response = self.wait_for_response(request_id, method, locked, None)?;
        decode_result(response, self.provider)
    }

    pub(super) fn run_prompt(
        &mut self,
        session_id: &str,
        text: &str,
        cancel_after: Option<Duration>,
    ) -> Result<PromptResponse> {
        self.ensure_known_session(session_id)?;
        self.last_prompt = Some(PromptLifecycleSnapshot {
            identity: identity(self.provider, &SessionId::new(session_id)),
            state: PromptLifecycleState::Running,
            stop_reason: None,
            raw_update_count: 0,
        });
        let request_id = self.allocate_request_id();
        let request =
            JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Request(Request {
                id: request_id.clone(),
                method: Arc::from(AGENT_METHOD_NAMES.session_prompt),
                params: Some(ClientRequest::PromptRequest(PromptRequest::new(
                    SessionId::new(session_id),
                    vec![ContentBlock::from(text.to_owned())],
                ))),
            }));
        let value =
            to_value(&request).map_err(|error| unexpected(self.provider, error.to_string()))?;
        validate_locked_request_envelope(&self.contract_bundle, &value)?;
        self.send_json("session/prompt", &value)?;
        let response = self.wait_for_response(
            request_id,
            "session/prompt",
            LockedMethod::SessionPrompt,
            cancel_after.map(|after| (SessionId::new(session_id), Instant::now() + after)),
        )?;
        let prompt: PromptResponse = decode_result(response, self.provider)?;
        self.finish_prompt(session_id, &prompt);
        Ok(prompt)
    }

    pub(super) fn send_json(&mut self, operation: &str, value: &Value) -> Result<()> {
        let line =
            to_string(value).map_err(|error| unexpected(self.provider, error.to_string()))?;
        self.transport.send_line(self.provider, operation, &line)?;
        self.request_envelopes.push(value.clone());
        let sequence = self.allocate_sequence();
        self.raw_events.push(RawWireEvent::rpc(
            sequence,
            WireStream::Outgoing,
            line,
            value.clone(),
        ));
        Ok(())
    }

    pub(super) fn respond_method_not_found(
        &mut self,
        request_id: &str,
        method: &str,
    ) -> Result<()> {
        let id = request_id
            .parse::<i64>()
            .map(RequestId::from)
            .unwrap_or_else(|_| RequestId::Str(request_id.to_owned()));
        let response = JsonRpcMessage::wrap(OutgoingMessage::<ClientSide, AgentSide>::Response(
            Response::<agent_client_protocol_schema::ClientResponse>::Error {
                id,
                error: Error::method_not_found().data(json!({ "method": method })),
            },
        ));
        let value =
            to_value(&response).map_err(|error| unexpected(self.provider, error.to_string()))?;
        self.send_json("agent-request-error", &value)
    }

    pub(super) fn record_incoming(&mut self, value: Value, line: String) {
        let sequence = self.allocate_sequence();
        self.raw_events.push(RawWireEvent::rpc(
            sequence,
            WireStream::Incoming,
            line,
            value,
        ));
    }

    pub(super) fn record_diagnostic(&mut self, line: String) {
        let sequence = self.allocate_sequence();
        self.raw_events
            .push(RawWireEvent::diagnostic(sequence, line));
    }

    fn allocate_request_id(&mut self) -> RequestId {
        let request_id = RequestId::from(self.next_request_id);
        self.next_request_id += 1;
        request_id
    }

    fn allocate_sequence(&mut self) -> u64 {
        self.sequence += 1;
        self.sequence
    }

    pub(super) fn initialize_field(&self, field: &str) -> Value {
        self.response_envelopes
            .last()
            .and_then(|response| response.get("result"))
            .and_then(|result| result.get(field))
            .cloned()
            .unwrap_or(Value::Null)
    }

    pub(super) fn initialize_auth_methods(&self) -> Vec<Value> {
        self.initialize_field("authMethods")
            .as_array()
            .map(|items| items.to_vec())
            .unwrap_or_default()
    }

    fn ensure_known_session(&self, session_id: &str) -> Result<()> {
        if self.live_sessions.contains_key(session_id) {
            return Ok(());
        }
        Err(AcpError::UnknownSession {
            provider: self.provider,
            session_id: session_id.to_owned(),
        })
    }

    fn finish_prompt(&mut self, session_id: &str, response: &PromptResponse) {
        let state = match stop_reason_string(response) {
            Some(reason) if reason == "cancelled" => PromptLifecycleState::Cancelled,
            _ => PromptLifecycleState::Completed,
        };
        self.last_prompt = Some(PromptLifecycleSnapshot {
            identity: identity(self.provider, &SessionId::new(session_id)),
            state,
            stop_reason: stop_reason_string(response),
            raw_update_count: self
                .last_prompt
                .as_ref()
                .map(|entry| entry.raw_update_count)
                .unwrap_or(0),
        });
    }

    pub(super) fn bump_prompt_updates(&mut self) {
        if let Some(snapshot) = &mut self.last_prompt {
            snapshot.raw_update_count += 1;
        }
    }
}

impl Drop for AcpHost {
    fn drop(&mut self) {
        self.disconnect();
    }
}
