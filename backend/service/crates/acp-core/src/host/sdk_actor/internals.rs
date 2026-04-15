use super::unexpected;
use crate::error::{AcpError, Result};
use acp_discovery::{ProcessEnvironment, ProviderId};
use agent_client_protocol as acp;
use serde_json::{Value, to_value};
use std::sync::mpsc::Sender;

pub(super) fn child_has_exited(child: &mut Option<tokio::process::Child>) -> bool {
    child
        .as_mut()
        .and_then(|process| process.try_wait().ok())
        .flatten()
        .is_some()
}

pub(super) fn to_values<T>(provider: ProviderId, values: Vec<T>, field: &str) -> Result<Vec<Value>>
where
    T: serde::Serialize,
{
    values
        .into_iter()
        .map(|value| {
            to_value(value).map_err(|error| unexpected(provider, format!("{field}: {error}")))
        })
        .collect()
}

pub(super) fn disconnected(provider: ProviderId, operation: &str) -> AcpError {
    AcpError::StreamClosed {
        provider,
        stream: "official-sdk".to_owned(),
        operation: operation.to_owned(),
    }
}

pub(super) fn apply_process_environment(
    command: &mut tokio::process::Command,
    environment: &ProcessEnvironment,
) {
    if let Some(current_dir) = &environment.current_dir {
        command.current_dir(current_dir);
    }
    for (key, value) in &environment.env {
        command.env(key, value);
    }
}

pub(super) fn send_reply<T>(reply: Sender<Result<T>>, result: Result<T>) {
    let _result = reply.send(result);
}

pub(super) fn sdk_error(provider: ProviderId, operation: &str, source: acp::Error) -> AcpError {
    AcpError::Sdk {
        provider,
        operation: operation.to_owned(),
        source,
    }
}
