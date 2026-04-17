use super::{
    create_output_dir, normalize_capture, read_prompt_blocks, validate_session_list,
    validate_session_load, validate_session_new, validate_session_prompt, write_json,
};
use crate::cli::CaptureOperation;
use serde_json::json;
use std::fs::{create_dir, read_to_string, write};
use tempfile::TempDir;

#[test]
fn accepts_session_list_with_sessions_array() {
    assert!(validate_session_list(&json!({ "sessions": [] })).is_ok());
}

#[test]
fn accepts_session_new_with_session_id() {
    assert!(validate_session_new(&json!({ "sessionId": "session-1" })).is_ok());
}

#[test]
fn rejects_session_new_without_session_id() {
    let error = validate_session_new(&json!({ "models": {} }))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    assert!(error.contains("sessionId string"));
}

#[test]
fn rejects_session_list_without_sessions_array() {
    let error = validate_session_list(&json!({ "nextCursor": null }))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    assert!(error.contains("sessions array"));
}

#[test]
fn accepts_session_load_with_response_and_loaded_transcript_updates() {
    assert!(
        validate_session_load(&json!({
            "response": {},
            "loadedTranscript": {
                "rawUpdateCount": 0,
                "updates": []
            }
        }))
        .is_ok()
    );
}

#[test]
fn rejects_session_load_without_response() {
    let error = validate_session_load(&json!({
        "loadedTranscript": {
            "rawUpdateCount": 0,
            "updates": []
        }
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("response field"));
}

#[test]
fn rejects_session_load_without_loaded_transcript_update_count() {
    let error = validate_session_load(&json!({
        "response": {},
        "loadedTranscript": { "updates": [] }
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("rawUpdateCount number"));
}

#[test]
fn rejects_session_load_without_loaded_transcript_updates() {
    let error = validate_session_load(&json!({
        "response": {},
        "loadedTranscript": { "rawUpdateCount": 0 }
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("loadedTranscript.updates array"));
}

#[test]
fn accepts_session_prompt_with_prompt_request_response_and_updates() {
    assert!(
        validate_session_prompt(&json!({
            "sessionNew": null,
            "promptRequest": {
                "sessionId": "session-1",
                "prompt": [{ "type": "text", "text": "hello" }]
            },
            "promptResponse": { "stopReason": "end_turn" },
            "promptUpdates": []
        }))
        .is_ok()
    );
}

#[test]
fn rejects_session_prompt_without_prompt_request_session_id() {
    let error = validate_session_prompt(&json!({
        "promptRequest": { "prompt": [] },
        "promptResponse": { "stopReason": "end_turn" },
        "promptUpdates": []
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("promptRequest.sessionId string"));
}

#[test]
fn rejects_session_prompt_without_prompt_response_stop_reason() {
    let error = validate_session_prompt(&json!({
        "promptRequest": { "sessionId": "session-1", "prompt": [] },
        "promptResponse": {},
        "promptUpdates": []
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("promptResponse.stopReason string"));
}

#[test]
fn rejects_session_prompt_without_updates() {
    let error = validate_session_prompt(&json!({
        "promptRequest": { "sessionId": "session-1", "prompt": [] },
        "promptResponse": { "stopReason": "end_turn" }
    }))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("promptUpdates array"));
}

#[test]
fn reads_prompt_content_block_array() -> Result<(), Box<dyn std::error::Error>> {
    let tempdir = TempDir::new()?;
    let path = tempdir.path().join("prompt.json");
    write(&path, r#"[{"type":"text","text":"hello"}]"#)?;
    let blocks = read_prompt_blocks(&path)?;
    if blocks != vec![json!({ "type": "text", "text": "hello" })] {
        return Err("prompt blocks did not parse".into());
    }
    Ok(())
}

#[test]
fn rejects_prompt_file_that_is_not_content_block_array() -> Result<(), Box<dyn std::error::Error>> {
    let tempdir = TempDir::new()?;
    let path = tempdir.path().join("prompt.json");
    write(&path, r#"{"type":"text","text":"hello"}"#)?;
    let error = read_prompt_blocks(&path)
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    if !error.contains("ContentBlock array") {
        return Err("expected ContentBlock array error".into());
    }
    Ok(())
}

#[test]
fn normalizes_session_prompt_with_canonical_projection() -> Result<(), Box<dyn std::error::Error>> {
    let normalized = normalize_capture(
        &CaptureOperation::Prompt {
            session_id: None,
            prompt_path: "prompt.json".into(),
        },
        &json!({
            "sessionNew": { "sessionId": "session-1" },
            "promptRequest": {
                "sessionId": "session-1",
                "prompt": [{ "type": "text", "text": "hello" }]
            },
            "promptResponse": { "stopReason": "end_turn" },
            "promptUpdates": [
                {
                    "index": 0,
                    "variant": "agent_message_chunk",
                    "update": {
                        "sessionUpdate": "agent_message_chunk",
                        "content": { "type": "text", "text": "fixture" }
                    }
                },
                {
                    "index": 1,
                    "variant": "agent_message_chunk",
                    "update": {
                        "sessionUpdate": "agent_message_chunk",
                        "content": { "type": "text", "text": "-ready" }
                    }
                }
            ]
        }),
    )?;

    if normalized
        .pointer("/items/0/role")
        .and_then(serde_json::Value::as_str)
        != Some("user")
    {
        return Err("expected projected user message".into());
    }
    if normalized
        .pointer("/items/1/role")
        .and_then(serde_json::Value::as_str)
        != Some("agent")
    {
        return Err("expected projected agent message".into());
    }
    let agent_content = normalized
        .pointer("/items/1/content")
        .and_then(serde_json::Value::as_array)
        .ok_or("missing agent content")?;
    let agent_text = agent_content
        .iter()
        .filter_map(|block| block.get("text").and_then(serde_json::Value::as_str))
        .collect::<String>();
    if agent_text != "fixture-ready" {
        return Err(format!("expected joined agent text, got {agent_text}").into());
    }
    Ok(())
}

#[test]
fn writer_refuses_existing_output_directory() -> Result<(), Box<dyn std::error::Error>> {
    let tempdir = TempDir::new()?;
    let output = tempdir.path().join("capture");
    create_dir(&output)?;
    let error = create_output_dir(&output)
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    if !error.contains("capture") {
        return Err("expected existing output directory error".into());
    }
    Ok(())
}

#[test]
fn writes_pretty_json_file() -> Result<(), Box<dyn std::error::Error>> {
    let tempdir = TempDir::new()?;
    let path = tempdir.path().join("provider.raw.json");
    write_json(&path, &json!({ "sessions": [] }))?;
    let body = read_to_string(path)?;
    if !body.contains("\"sessions\"") {
        return Err("expected sessions field in JSON body".into());
    }
    Ok(())
}
