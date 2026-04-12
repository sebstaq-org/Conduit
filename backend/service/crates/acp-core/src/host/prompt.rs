//! Prompt-turn helpers for the SDK host actor.

use super::helpers::unexpected;
use crate::Result;
use acp_discovery::ProviderId;
use agent_client_protocol as acp;
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

pub(super) fn permission_response(
    args: acp::RequestPermissionRequest,
) -> acp::RequestPermissionResponse {
    if let Some(option) = args.options.iter().find(|option| {
        matches!(
            option.kind,
            acp::PermissionOptionKind::RejectOnce | acp::PermissionOptionKind::RejectAlways
        )
    }) {
        return acp::RequestPermissionResponse::new(acp::RequestPermissionOutcome::Selected(
            acp::SelectedPermissionOutcome::new(option.option_id.clone()),
        ));
    }
    acp::RequestPermissionResponse::new(acp::RequestPermissionOutcome::Cancelled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_response_selects_reject_option_when_available() -> std::result::Result<(), String>
    {
        let response = permission_response(permission_request(vec![
            acp::PermissionOption::new(
                "allow-once",
                "Allow once",
                acp::PermissionOptionKind::AllowOnce,
            ),
            acp::PermissionOption::new(
                "reject-once",
                "Reject",
                acp::PermissionOptionKind::RejectOnce,
            ),
        ]));

        let acp::RequestPermissionOutcome::Selected(outcome) = response.outcome else {
            return Err("expected selected reject option".to_owned());
        };
        if outcome.option_id.0.as_ref() != "reject-once" {
            return Err(format!("expected reject-once, got {}", outcome.option_id.0));
        }
        Ok(())
    }

    #[test]
    fn permission_response_cancels_when_no_reject_option_exists() -> std::result::Result<(), String>
    {
        let response = permission_response(permission_request(vec![acp::PermissionOption::new(
            "allow-once",
            "Allow once",
            acp::PermissionOptionKind::AllowOnce,
        )]));

        if matches!(response.outcome, acp::RequestPermissionOutcome::Cancelled) {
            return Ok(());
        }
        Err("expected cancelled fallback when no reject option exists".to_owned())
    }

    fn permission_request(options: Vec<acp::PermissionOption>) -> acp::RequestPermissionRequest {
        acp::RequestPermissionRequest::new(
            "session-1",
            acp::ToolCallUpdate::new("tool-1", acp::ToolCallUpdateFields::new()),
            options,
        )
    }
}
