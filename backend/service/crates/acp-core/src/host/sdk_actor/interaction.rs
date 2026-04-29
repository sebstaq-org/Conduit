//! Pending user interaction registry for ACP permission requests.

use super::super::InteractionResponse;
use super::super::helpers::unexpected;
use crate::error::{AcpError, Result};
use acp_discovery::ProviderId;
use agent_client_protocol::schema as acp;
use serde_json::json;
use std::collections::{HashMap, HashSet, hash_map::Entry};
use std::sync::{LazyLock, Mutex};
use tokio::sync::oneshot;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct InteractionKey {
    provider: ProviderId,
    session_id: String,
    interaction_id: String,
}

struct PendingInteraction {
    response_tx: oneshot::Sender<acp::RequestPermissionResponse>,
}

#[derive(Default)]
struct InteractionRegistry {
    pending: HashMap<InteractionKey, PendingInteraction>,
    resolved: HashSet<InteractionKey>,
}

static INTERACTION_REGISTRY: LazyLock<Mutex<InteractionRegistry>> =
    LazyLock::new(|| Mutex::new(InteractionRegistry::default()));

pub(super) fn respond_interaction(
    provider: ProviderId,
    session_id: &str,
    interaction_id: &str,
    response: InteractionResponse,
) -> Result<()> {
    let key = InteractionKey {
        provider,
        session_id: session_id.to_owned(),
        interaction_id: interaction_id.to_owned(),
    };
    let pending = {
        let mut registry = INTERACTION_REGISTRY
            .lock()
            .map_err(|error| unexpected(provider, error.to_string()))?;
        if let Some(pending) = registry.pending.remove(&key) {
            registry.resolved.insert(key.clone());
            pending
        } else if registry.resolved.contains(&key) {
            return Err(AcpError::ResolvedInteraction {
                provider,
                session_id: session_id.to_owned(),
                interaction_id: interaction_id.to_owned(),
            });
        } else {
            return Err(AcpError::UnknownInteraction {
                provider,
                session_id: session_id.to_owned(),
                interaction_id: interaction_id.to_owned(),
            });
        }
    };
    let payload = permission_response_from_interaction(provider, interaction_id, response)?;
    pending
        .response_tx
        .send(payload)
        .map_err(|_error| AcpError::ResolvedInteraction {
            provider,
            session_id: session_id.to_owned(),
            interaction_id: interaction_id.to_owned(),
        })?;
    Ok(())
}

pub(super) fn register_pending_interaction(
    provider: ProviderId,
    session_id: String,
    interaction_id: String,
    response_tx: oneshot::Sender<acp::RequestPermissionResponse>,
) -> Result<()> {
    let key = InteractionKey {
        provider,
        session_id,
        interaction_id,
    };
    let mut registry = INTERACTION_REGISTRY
        .lock()
        .map_err(|error| unexpected(provider, error.to_string()))?;
    registry.resolved.remove(&key);
    match registry.pending.entry(key) {
        Entry::Vacant(entry) => {
            entry.insert(PendingInteraction { response_tx });
        }
        Entry::Occupied(entry) => {
            return Err(AcpError::InvalidInteractionResponse {
                provider,
                interaction_id: entry.key().interaction_id.clone(),
                message: "interaction id collision while registering pending request",
            });
        }
    }
    Ok(())
}

pub(super) fn cancel_pending_interactions_for_provider(provider: ProviderId) {
    let mut cancelled = Vec::new();
    if let Ok(mut registry) = INTERACTION_REGISTRY.lock() {
        let keys = registry
            .pending
            .keys()
            .filter(|key| key.provider == provider)
            .cloned()
            .collect::<Vec<_>>();
        for key in keys {
            if let Some(pending) = registry.pending.remove(&key) {
                cancelled.push((pending.response_tx, key.clone()));
                registry.resolved.remove(&key);
            }
        }
        registry.resolved.retain(|key| key.provider != provider);
    }
    for (response_tx, _key) in cancelled {
        let _send_status = response_tx.send(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        ));
    }
}

pub(super) fn cancel_pending_interactions_for_session(provider: ProviderId, session_id: &str) {
    let mut cancelled = Vec::new();
    if let Ok(mut registry) = INTERACTION_REGISTRY.lock() {
        let keys = registry
            .pending
            .keys()
            .filter(|key| key.provider == provider && key.session_id == session_id)
            .cloned()
            .collect::<Vec<_>>();
        for key in keys {
            if let Some(pending) = registry.pending.remove(&key) {
                cancelled.push(pending.response_tx);
                registry.resolved.remove(&key);
            }
        }
        registry
            .resolved
            .retain(|key| !(key.provider == provider && key.session_id == session_id));
    }
    for response_tx in cancelled {
        let _send_status = response_tx.send(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        ));
    }
}

fn permission_response_from_interaction(
    provider: ProviderId,
    interaction_id: &str,
    response: InteractionResponse,
) -> Result<acp::RequestPermissionResponse> {
    match response {
        InteractionResponse::Selected { option_id } => {
            if option_id.trim().is_empty() {
                return Err(invalid_interaction_response(
                    provider,
                    interaction_id,
                    "selected option id must be non-empty",
                ));
            }
            Ok(acp::RequestPermissionResponse::new(
                acp::RequestPermissionOutcome::Selected(acp::SelectedPermissionOutcome::new(
                    option_id,
                )),
            ))
        }
        InteractionResponse::AnswerOther {
            option_id,
            question_id,
            text,
        } => {
            permission_response_answer_other(provider, interaction_id, option_id, question_id, text)
        }
        InteractionResponse::Cancelled => Ok(acp::RequestPermissionResponse::new(
            acp::RequestPermissionOutcome::Cancelled,
        )),
    }
}

fn permission_response_answer_other(
    provider: ProviderId,
    interaction_id: &str,
    option_id: String,
    question_id: String,
    text: String,
) -> Result<acp::RequestPermissionResponse> {
    if option_id.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other option id must be non-empty",
        ));
    }
    if question_id.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other question id must be non-empty",
        ));
    }
    if text.trim().is_empty() {
        return Err(invalid_interaction_response(
            provider,
            interaction_id,
            "answer-other text must be non-empty",
        ));
    }
    let meta = serde_json::Map::from_iter([(
        "request_user_input_response".to_owned(),
        json!({
            "answers": {
                question_id: {
                    "answers": [text]
                }
            }
        }),
    )]);
    Ok(acp::RequestPermissionResponse::new(
        acp::RequestPermissionOutcome::Selected(
            acp::SelectedPermissionOutcome::new(option_id).meta(meta),
        ),
    ))
}

fn invalid_interaction_response(
    provider: ProviderId,
    interaction_id: &str,
    message: &'static str,
) -> AcpError {
    AcpError::InvalidInteractionResponse {
        provider,
        interaction_id: interaction_id.to_owned(),
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn answer_other_response_includes_request_user_input_meta()
    -> std::result::Result<(), Box<dyn std::error::Error>> {
        let response = permission_response_from_interaction(
            ProviderId::Codex,
            "interaction-1",
            InteractionResponse::AnswerOther {
                option_id: "answer-other".to_owned(),
                question_id: "plan_target".to_owned(),
                text: "custom choice".to_owned(),
            },
        )?;
        let payload = serde_json::to_value(response)?;
        if payload
            .pointer("/outcome/_meta/request_user_input_response/answers/plan_target/answers/0")
            .and_then(Value::as_str)
            == Some("custom choice")
        {
            return Ok(());
        }
        Err(format!("missing answer-other meta payload: {payload}").into())
    }

    #[test]
    fn selected_response_requires_non_empty_option_id() {
        let result = permission_response_from_interaction(
            ProviderId::Codex,
            "interaction-1",
            InteractionResponse::Selected {
                option_id: " ".to_owned(),
            },
        );
        assert!(
            matches!(result, Err(AcpError::InvalidInteractionResponse { .. })),
            "expected invalid interaction response, got {result:?}"
        );
    }

    #[test]
    fn register_collision_keeps_existing_pending_sender()
    -> std::result::Result<(), Box<dyn std::error::Error>> {
        let session_id = "register-collision-keeps-existing-pending-sender";
        let interaction_id = "interaction-1";
        let (first_tx, mut first_rx) = oneshot::channel();
        let (second_tx, mut second_rx) = oneshot::channel();

        register_pending_interaction(
            ProviderId::Codex,
            session_id.to_owned(),
            interaction_id.to_owned(),
            first_tx,
        )?;
        let collision = register_pending_interaction(
            ProviderId::Codex,
            session_id.to_owned(),
            interaction_id.to_owned(),
            second_tx,
        );

        if !matches!(collision, Err(AcpError::InvalidInteractionResponse { .. })) {
            return Err(
                format!("expected invalid interaction collision, got {collision:?}").into(),
            );
        }
        cancel_pending_interactions_for_session(ProviderId::Codex, session_id);

        match first_rx.try_recv() {
            Ok(response) => {
                let payload = serde_json::to_value(response)?;
                if payload.pointer("/outcome/outcome").and_then(Value::as_str) != Some("cancelled")
                {
                    return Err(format!(
                        "expected first sender to receive cancellation: {payload}"
                    )
                    .into());
                }
            }
            Err(error) => {
                return Err(format!("expected first sender to remain registered: {error}").into());
            }
        }
        match second_rx.try_recv() {
            Err(oneshot::error::TryRecvError::Closed) => Ok(()),
            Ok(value) => {
                let payload = serde_json::to_value(value)?;
                Err(format!("unexpected second sender response: {payload}").into())
            }
            Err(error) => Err(format!("unexpected second sender state: {error}").into()),
        }
    }
}
