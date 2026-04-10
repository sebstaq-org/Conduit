//! Inbound response waiting and prompt-cancel scheduling helpers.

use super::helpers::{is_session_update, request_id_string, request_method, response_matches};
use super::{AcpHost, POLL_SLICE, REQUEST_TIMEOUT};
use crate::error::{AcpError, Result};
use crate::transport::InboundLine;
use acp_contracts::{LockedMethod, validate_locked_response_envelope};
use agent_client_protocol_schema::{RequestId, SessionId};
use serde_json::Value;
use std::time::Instant;

impl AcpHost {
    pub(super) fn wait_for_response(
        &mut self,
        request_id: RequestId,
        operation: &str,
        locked: LockedMethod,
        cancel: Option<(SessionId, Instant)>,
    ) -> Result<Value> {
        let deadline = Instant::now() + REQUEST_TIMEOUT;
        let mut cancel = cancel;
        while Instant::now() < deadline {
            self.maybe_send_scheduled_cancel(&mut cancel)?;
            match self.transport.inbound().recv_timeout(POLL_SLICE) {
                Ok(line) => {
                    if let Some(value) =
                        self.handle_inbound_line(line, &request_id, operation, locked)?
                    {
                        return Ok(value);
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    return Err(self.disconnected_error(operation));
                }
            }
        }
        Err(self.timeout_error(operation))
    }

    fn maybe_send_scheduled_cancel(
        &mut self,
        cancel: &mut Option<(SessionId, Instant)>,
    ) -> Result<()> {
        if let Some((session_id, at)) = cancel
            && Instant::now() >= *at
        {
            self.cancel_prompt(&session_id.to_string())?;
            *cancel = None;
        }
        Ok(())
    }

    fn handle_inbound_line(
        &mut self,
        inbound: InboundLine,
        request_id: &RequestId,
        operation: &str,
        locked: LockedMethod,
    ) -> Result<Option<Value>> {
        match inbound {
            InboundLine::Stdout(line) => self.handle_stdout_line(line, request_id, locked),
            InboundLine::Stderr(line) => {
                self.record_diagnostic(line);
                Ok(None)
            }
            InboundLine::Closed(stream) => Err(AcpError::StreamClosed {
                provider: self.provider,
                stream: stream.to_owned(),
                operation: operation.to_owned(),
            }),
        }
    }

    fn handle_stdout_line(
        &mut self,
        line: String,
        request_id: &RequestId,
        locked: LockedMethod,
    ) -> Result<Option<Value>> {
        let value = serde_json::from_str::<Value>(&line).map_err(|source| AcpError::Json {
            provider: self.provider,
            line: line.clone(),
            source,
        })?;
        self.record_incoming(value.clone(), line);
        if response_matches(&value, request_id) {
            if value.get("result").is_some() {
                validate_locked_response_envelope(&self.contract_bundle, locked, &value)?;
            }
            self.response_envelopes.push(value.clone());
            return Ok(Some(value));
        }
        if is_session_update(&value) {
            self.bump_prompt_updates();
            return Ok(None);
        }
        if let Some(method) = request_method(&value) {
            self.respond_method_not_found(&request_id_string(&value), &method)?;
            return Err(AcpError::UnsupportedAgentRequest {
                provider: self.provider,
                method,
            });
        }
        Ok(None)
    }

    fn timeout_error(&self, operation: &str) -> AcpError {
        AcpError::Timeout {
            provider: self.provider,
            operation: operation.to_owned(),
            timeout: REQUEST_TIMEOUT,
        }
    }

    fn disconnected_error(&self, operation: &str) -> AcpError {
        AcpError::StreamClosed {
            provider: self.provider,
            stream: "stdout".to_owned(),
            operation: operation.to_owned(),
        }
    }
}
