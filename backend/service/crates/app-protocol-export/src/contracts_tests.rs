//! Tests for generated app protocol contracts.

use crate::contracts::{ProtocolSchema, TypeScriptEmitter, acp_schema_value, root_definition};
use acp_core::{
    ConduitInteractionRequestData, ConduitInteractionResolutionData, ConduitTerminalPlanData,
};
use agent_client_protocol_schema as acp;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use service_runtime::ConsumerResponse;
use service_runtime::consumer_protocol::{
    ConduitProvidersConfigSnapshotResult, ConduitRuntimeEvent, ConduitServerEventFrame,
    ConduitServerFrame, ConduitServerResponseFrame, ConduitSessionOpenResult,
};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

#[test]
fn selected_roots_match_vendored_acp_schema() -> Result<(), Box<dyn Error>> {
    let vendored =
        read_json(&repo_root()?.join("vendor/agent-client-protocol/schema/schema.json"))?;
    let generated = generated_schema()?;
    for name in [
        "SessionUpdate",
        "ConfigOptionUpdate",
        "SessionConfigOption",
        "EmbeddedResource",
        "EmbeddedResourceResource",
    ] {
        ensure_equal(
            definition(&generated, name)?,
            definition(&vendored, name)?,
            &format!("schema definition {name} should match vendored ACP"),
        )?;
    }
    Ok(())
}

#[test]
fn generated_contracts_keep_structured_ui_fields() -> Result<(), Box<dyn Error>> {
    let output = TypeScriptEmitter::new(ProtocolSchema::from_backend_types()?).emit()?;
    ensure_contains(
        &output,
        "configOptions: z.array(AcpSessionConfigOptionSchema)",
    )?;
    ensure_contains(&output, "resource: AcpEmbeddedResourceResourceSchema")?;
    ensure_missing(
        &output,
        "configOptions: z.array(z.record(z.string(), z.unknown()))",
    )?;
    ensure_missing(&output, "resource: z.unknown()")?;
    ensure_contains(&output, "const ConduitServerFrameSchema")?;
    ensure_contains(&output, "const ConduitInteractionRequestDataSchema")?;
    ensure_contains(&output, "const ConduitInteractionResolutionDataSchema")?;
    ensure_contains(&output, "const ConduitTerminalPlanDataSchema")?;
    ensure_contains(&output, "v: z.literal(1)")?;
    ensure_contains(&output, "}).strict()")?;
    ensure_contains(&output, "items: z.array(ConduitTranscriptItemSchema)")?;
    ensure_contains(
        &output,
        "configOptions: z.union([z.array(AcpSessionConfigOptionSchema), z.null()]).optional()",
    )?;
    Ok(())
}

#[test]
fn conduit_consumer_contract_fixtures_roundtrip_through_backend_serde() -> Result<(), Box<dyn Error>>
{
    event_frame_constructor_matches_wire_fixture()?;
    response_frame_constructor_matches_wire_fixture()?;
    roundtrip::<ConduitSessionOpenResult>(serde_json::json!({
        "sessionId": "session-1",
        "configOptions": null,
        "modes": null,
        "models": null,
        "currentModeId": null,
        "openSessionId": "open-1",
        "revision": 3,
        "items": [],
        "nextCursor": null
    }))?;
    roundtrip::<ConduitProvidersConfigSnapshotResult>(serde_json::json!({
        "entries": [{
            "provider": "codex",
            "status": "loading",
            "configOptions": null,
            "modes": null,
            "models": null,
            "fetchedAt": null,
            "error": null
        }]
    }))?;
    roundtrip::<ConduitInteractionRequestData>(serde_json::json!({
        "sessionUpdate": "interaction_request",
        "interactionId": "interaction-1",
        "toolCallId": "tool-call-1",
        "requestType": "request_user_input",
        "questionId": "question-1",
        "questionHeader": "Question",
        "question": "Proceed?",
        "isOther": true,
        "options": [{ "kind": "allow_once", "name": "Yes", "optionId": "yes" }],
        "status": "pending",
        "rawInput": null
    }))?;
    roundtrip::<ConduitInteractionResolutionData>(serde_json::json!({
        "sessionUpdate": "interaction_resolution",
        "interactionId": "interaction-1",
        "toolCallId": "tool-call-1",
        "status": "resolved",
        "rawOutput": null
    }))?;
    roundtrip::<ConduitTerminalPlanData>(serde_json::json!({
        "sessionUpdate": "terminal_plan",
        "interactionId": "terminal-plan:item-1",
        "itemId": "item-1",
        "planText": "# Plan\n",
        "source": "codex.terminalPlan",
        "providerSource": "TurnItem::Plan",
        "status": "pending",
        "codexTurnId": "turn-1",
        "threadId": "thread-1"
    }))?;
    Ok(())
}

fn event_frame_constructor_matches_wire_fixture() -> Result<(), Box<dyn Error>> {
    let event: ConduitRuntimeEvent = serde_json::from_value(event_payload_fixture())?;
    ensure_equal(
        &serde_json::to_value(ConduitServerFrame::Event(ConduitServerEventFrame::new(
            event,
        )))?,
        &serde_json::json!({
            "v": 1,
            "type": "event",
            "event": event_payload_fixture()
        }),
        "Conduit event frame constructor should match the wire fixture",
    )
}

fn response_frame_constructor_matches_wire_fixture() -> Result<(), Box<dyn Error>> {
    let response_frame = ConduitServerResponseFrame::from_runtime_response(
        "cmd-1".to_owned(),
        ConsumerResponse {
            id: "cmd-1".to_owned(),
            ok: true,
            result: serde_json::json!({ "subscribed": true }),
            error: None,
            snapshot: None,
        },
    )?;
    ensure_equal(
        &serde_json::to_value(ConduitServerFrame::Response(response_frame))?,
        &serde_json::json!({
            "v": 1,
            "type": "response",
            "id": "cmd-1",
            "response": {
                "id": "cmd-1",
                "ok": true,
                "result": { "subscribed": true },
                "error": null,
                "snapshot": null
            }
        }),
        "Conduit response frame constructor should match the wire fixture",
    )
}

fn event_payload_fixture() -> Value {
    serde_json::json!({
        "kind": "session_timeline_changed",
        "openSessionId": "open-1",
        "revision": 7,
        "items": [{
            "kind": "message",
            "id": "item-1",
            "role": "agent",
            "content": [{ "type": "text", "text": "hello" }]
        }]
    })
}

#[test]
fn parity_fixtures_roundtrip_through_backend_serde() -> Result<(), Box<dyn Error>> {
    let fixtures = read_json(&repo_root()?.join("scripts/app-protocol.fixtures.json"))?;
    let Some(fixtures) = fixtures.as_object() else {
        return Err("app protocol fixtures must be a JSON object".into());
    };
    for fixture in fixtures.values() {
        let update: acp::SessionUpdate = serde_json::from_value(fixture.clone())?;
        ensure_equal(
            &serde_json::to_value(update)?,
            fixture,
            "fixture should roundtrip",
        )?;
    }
    Ok(())
}

fn ensure_contains(haystack: &str, needle: &str) -> Result<(), Box<dyn Error>> {
    if haystack.contains(needle) {
        Ok(())
    } else {
        Err(format!("generated contracts should contain {needle}").into())
    }
}

fn ensure_missing(haystack: &str, needle: &str) -> Result<(), Box<dyn Error>> {
    if haystack.contains(needle) {
        Err(format!("generated contracts should not contain {needle}").into())
    } else {
        Ok(())
    }
}

fn ensure_equal(left: &Value, right: &Value, message: &str) -> Result<(), Box<dyn Error>> {
    if left == right {
        Ok(())
    } else {
        Err(message.to_owned().into())
    }
}

fn roundtrip<T>(fixture: Value) -> Result<(), Box<dyn Error>>
where
    T: DeserializeOwned + Serialize,
{
    let parsed: T = serde_json::from_value(fixture.clone())?;
    ensure_equal(
        &serde_json::to_value(parsed)?,
        &fixture,
        "Conduit fixture should roundtrip",
    )
}

fn generated_schema() -> Result<Value, Box<dyn Error>> {
    let mut schema = acp_schema_value::<acp::SessionUpdate>()?;
    let root = root_definition(&schema);
    let Some(defs) = schema.get_mut("$defs").and_then(Value::as_object_mut) else {
        return Err("generated ACP schema did not contain $defs".into());
    };
    defs.insert("SessionUpdate".to_owned(), root);
    Ok(schema)
}

fn definition<'a>(schema: &'a Value, name: &str) -> Result<&'a Value, Box<dyn Error>> {
    schema
        .get("$defs")
        .and_then(Value::as_object)
        .and_then(|defs| defs.get(name))
        .ok_or_else(|| format!("schema definition {name} is missing").into())
}

fn read_json(path: &Path) -> Result<Value, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;
    serde_json::from_str(&content).map_err(Into::into)
}

fn repo_root() -> Result<PathBuf, Box<dyn Error>> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .nth(4)
        .map(Path::to_path_buf)
        .ok_or_else(|| "could not resolve repository root".into())
}
