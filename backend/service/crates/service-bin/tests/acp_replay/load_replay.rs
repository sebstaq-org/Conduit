//! Load replay assertions for the ACP replay integration test.

use super::support::{TestResult, response_snapshot};
use serde_json::Value;

pub(crate) fn assert_loaded_transcript_variants(
    frame: &Value,
    provider: &str,
    session_id: &str,
    expected: &[String],
) -> TestResult<()> {
    let transcripts = response_snapshot(frame)?
        .get("loaded_transcripts")
        .and_then(Value::as_array)
        .ok_or("snapshot did not include loaded_transcripts")?;
    let transcript = transcripts
        .iter()
        .find(|entry| {
            entry
                .get("identity")
                .and_then(|identity| identity.get("provider"))
                .and_then(Value::as_str)
                == Some(provider)
                && entry
                    .get("identity")
                    .and_then(|identity| identity.get("acp_session_id"))
                    .and_then(Value::as_str)
                    == Some(session_id)
        })
        .ok_or_else(|| {
            format!("snapshot did not include loaded transcript for {provider}/{session_id}")
        })?;
    let actual = transcript
        .get("updates")
        .and_then(Value::as_array)
        .ok_or("loaded transcript did not include updates")?
        .iter()
        .map(|update| {
            update
                .get("variant")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect::<Option<Vec<_>>>()
        .ok_or("loaded transcript update was missing variant")?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected loaded transcript variants {expected:?}, got {actual:?}").into())
}

pub(crate) fn assert_loaded_replay_context_oracle_present(scenario: &Value) -> TestResult<()> {
    let prompt_replay = scenario
        .get("replay")
        .and_then(|replay| replay.get("session_prompt"))
        .ok_or("scenario replay was missing session_prompt")?;
    if prompt_replay
        .get("requires_loaded_replay")
        .and_then(Value::as_bool)
        != Some(true)
    {
        return Err(
            "loaded replay context assertion requires session_prompt.requires_loaded_replay=true"
                .into(),
        );
    }
    if prompt_replay
        .get("expected_history_variants")
        .and_then(Value::as_array)
        .is_none_or(Vec::is_empty)
    {
        return Err("loaded replay context assertion requires expected_history_variants".into());
    }
    if prompt_replay
        .get("expected_history_text_includes")
        .and_then(Value::as_array)
        .is_none_or(Vec::is_empty)
    {
        return Err(
            "loaded replay context assertion requires expected_history_text_includes".into(),
        );
    }
    Ok(())
}

pub(crate) fn assert_loaded_replay_context_used(
    scenario: &Value,
    operation: &Value,
) -> TestResult<()> {
    if operation
        .get("assert_loaded_replay_context_used")
        .and_then(Value::as_bool)
        == Some(true)
    {
        return assert_loaded_replay_context_oracle_present(scenario);
    }
    Ok(())
}
