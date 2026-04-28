//! Prompt-turn helpers for the SDK host actor.

use super::helpers::unexpected;
use crate::Result;
use acp_discovery::ProviderId;
use agent_client_protocol::schema as acp;
use serde_json::{Value, to_value};

pub(super) fn stop_reason_string(response: &acp::PromptResponse) -> Option<String> {
    to_value(response.stop_reason)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
}

pub(super) fn prompt_content_blocks(
    provider: ProviderId,
    prompt: Vec<Value>,
) -> Result<Vec<acp::ContentBlock>> {
    prompt
        .into_iter()
        .map(|block| {
            serde_json::from_value(block)
                .map_err(|error| unexpected(provider, format!("session/prompt prompt: {error}")))
        })
        .collect()
}
