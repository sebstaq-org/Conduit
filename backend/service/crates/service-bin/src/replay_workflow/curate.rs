//! Deterministic curation from raw replay captures into candidate fixtures.

use super::{
    REPLAY_MANIFEST_SCHEMA, REPLAY_SCENARIO_SCHEMA, ReplayMetadata, default_candidate_root,
    invalid_capture, read_jsonl, read_metadata,
};
use crate::artifact::{write_json, write_jsonl, write_text};
use crate::error::{Result, ServiceError};
use acp_contracts::{
    LockedMethod, load_locked_contract_bundle, validate_locked_cancel_notification,
    validate_locked_request_envelope, validate_locked_response_envelope,
};
use acp_discovery::ProviderId;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;
use std::fs::create_dir_all;
use std::path::{Path, PathBuf};

pub(super) fn curate(raw_root: &Path, candidate_root: Option<PathBuf>) -> Result<()> {
    let metadata = read_metadata(&raw_root.join("metadata.json"))?;
    let root = candidate_root
        .unwrap_or_else(|| default_candidate_root(metadata.provider, &metadata.scenario));
    super::guard_not_committed_replay_root(&root)?;
    create_dir_all(&root).map_err(|source| ServiceError::PreparePath {
        path: root.clone(),
        source,
    })?;
    let raw_frames = read_jsonl(&raw_root.join("frames.jsonl"))?;
    validate_raw_wire_contracts(&raw_frames)?;
    let mut scrubber = Scrubber::new(metadata.provider, &metadata.scenario, &metadata.cwd);
    scrubber.collect_session_ids(&raw_frames);
    let frames = raw_frames
        .into_iter()
        .map(|frame| scrubber.scrub_value(frame))
        .collect::<Vec<_>>();
    let records = command_records(&frames)?;
    let candidate = CandidateFixture::from_records(metadata, frames, records)?;
    candidate.write(&root)?;
    super::run_replay_oracle_gate(Some(&root))
}

#[derive(Debug, Clone)]
struct CommandRecord {
    command: String,
    params: Value,
    ok: bool,
    result: Value,
    error: Option<Value>,
    snapshot: Option<Value>,
}

struct CandidateFixture {
    metadata: ReplayMetadata,
    scenario: Value,
    frames: Vec<Value>,
    expected_events: Vec<Value>,
    expected_snapshot: Value,
    manifest: Value,
    summary: String,
}

impl CandidateFixture {
    fn from_records(
        mut metadata: ReplayMetadata,
        frames: Vec<Value>,
        records: Vec<CommandRecord>,
    ) -> Result<Self> {
        metadata.curated_replay_safe_to_promote = true;
        let subscribe_index = records
            .iter()
            .position(|record| record.command == "events/subscribe")
            .ok_or_else(|| invalid_capture("capture did not include events/subscribe"))?;
        let expected_events = subscribe_events(&records[subscribe_index])?;
        let expected_snapshot = last_snapshot_before_subscribe(&records, subscribe_index)?;
        let scenario = build_scenario(&metadata, &records[..subscribe_index], &expected_events)?;
        let manifest = build_candidate_manifest(&metadata);
        let summary = candidate_summary(&metadata, &expected_events);
        Ok(Self {
            metadata,
            scenario,
            frames,
            expected_events,
            expected_snapshot,
            manifest,
            summary,
        })
    }

    fn write(&self, root: &Path) -> Result<()> {
        write_json(root.join("metadata.json"), &self.metadata)?;
        write_json(root.join("scenario.json"), &self.scenario)?;
        write_jsonl(root.join("frames.jsonl"), &self.frames)?;
        write_jsonl(root.join("expected-events.jsonl"), &self.expected_events)?;
        write_json(root.join("expected-snapshot.json"), &self.expected_snapshot)?;
        write_json(root.join("manifest.json"), &self.manifest)?;
        write_text(root.join("summary.md"), &self.summary)
    }
}

fn command_records(frames: &[Value]) -> Result<Vec<CommandRecord>> {
    let mut commands = Vec::new();
    let mut responses = BTreeMap::new();
    for frame in frames {
        match frame.get("type").and_then(Value::as_str) {
            Some("command") => commands.push(command_record_seed(frame)?),
            Some("response") => {
                let id = frame_id(frame)?;
                let response = frame
                    .get("response")
                    .cloned()
                    .ok_or_else(|| invalid_capture("response frame missing response"))?;
                responses.insert(id, response);
            }
            Some("event") | None => {}
            Some(_) => return Err(invalid_capture("unsupported frame type in raw capture")),
        }
    }
    commands
        .into_iter()
        .map(|mut record| {
            let response = responses
                .remove(&record.result_string("id")?)
                .ok_or_else(|| invalid_capture("command did not have a matching response"))?;
            record.ok = response.get("ok").and_then(Value::as_bool).unwrap_or(false);
            record.result = response.get("result").cloned().unwrap_or(Value::Null);
            record.error = response.get("error").cloned();
            record.snapshot = response.get("snapshot").cloned();
            Ok(record)
        })
        .collect()
}

fn command_record_seed(frame: &Value) -> Result<CommandRecord> {
    let command = frame
        .get("command")
        .ok_or_else(|| invalid_capture("command frame missing command"))?;
    Ok(CommandRecord {
        command: command
            .get("command")
            .and_then(Value::as_str)
            .ok_or_else(|| invalid_capture("command frame missing command name"))?
            .to_owned(),
        params: command.get("params").cloned().unwrap_or_else(|| json!({})),
        ok: false,
        result: json!({ "id": frame_id(frame)? }),
        error: None,
        snapshot: None,
    })
}

fn frame_id(frame: &Value) -> Result<String> {
    frame
        .get("id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_capture("frame missing id"))
}

impl CommandRecord {
    fn result_string(&self, key: &str) -> Result<String> {
        self.result
            .get(key)
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .ok_or_else(|| invalid_capture("command record was missing response correlation id"))
    }
}

fn build_scenario(
    metadata: &ReplayMetadata,
    records: &[CommandRecord],
    expected_events: &[Value],
) -> Result<Value> {
    let initialize = records
        .iter()
        .find(|record| record.command == "initialize" && record.ok)
        .ok_or_else(|| invalid_capture("capture did not include a successful initialize"))?;
    let mut scenario = json!({
        "schema": REPLAY_SCENARIO_SCHEMA,
        "provider": metadata.provider.as_str(),
        "name": metadata.scenario,
        "acp_protocol_version": initialize.result.get("protocolVersion").cloned().unwrap_or(json!(1)),
        "sdk_dependency": "agent-client-protocol =0.11.4",
        "capture_source": format!("capture://phase-2.2/{}", metadata.capture_id),
        "redaction_status": "candidate-public-repo-safe-structural-scrub",
        "session": {
            "session_id": first_session_id(records).unwrap_or_else(|| replay_session_id(metadata)),
            "cwd": "/__conduit_replay_cwd__"
        },
        "initialize": {
            "agent_info": initialize.result.get("agentInfo").cloned().unwrap_or_else(|| json!({})),
            "capabilities": initialize.result.get("agentCapabilities").cloned().unwrap_or_else(|| json!({})),
            "auth_methods": initialize.result.get("authMethods").cloned().unwrap_or_else(|| json!([]))
        },
        "consumer_sequence": consumer_sequence(records),
        "expected_event_kinds": expected_event_kinds(expected_events),
        "ignored_fields": dynamic_ignored_fields(),
        "observation": observation(metadata)
    });
    scenario["replay"] = replay_block(records)?;
    if let Some(prompt) = prompt_block(metadata, records)? {
        scenario["prompt"] = prompt;
    }
    Ok(scenario)
}

fn replay_block(records: &[CommandRecord]) -> Result<Value> {
    let mut replay = Map::new();
    for record in records {
        match record.command.as_str() {
            "session/new" if record.ok => insert_result(&mut replay, "session_new", &record.result),
            "session/list" if record.ok => {
                insert_result(&mut replay, "session_list", &record.result)
            }
            "session/load" if record.ok => {
                insert_result(&mut replay, "session_load", &record.result)
            }
            "session/load" => insert_missing_load(&mut replay, record)?,
            "session/prompt" if record.ok => {
                insert_result(&mut replay, "session_prompt", &record.result);
            }
            "initialize" | "snapshot/get" | "provider/disconnect" | "session/cancel" => {}
            _ => {}
        }
    }
    Ok(Value::Object(replay))
}

fn insert_result(replay: &mut Map<String, Value>, key: &str, result: &Value) {
    replay.insert(key.to_owned(), json!({ "result": result }));
}

fn insert_missing_load(replay: &mut Map<String, Value>, record: &CommandRecord) -> Result<()> {
    let session_id = record
        .params
        .get("session_id")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid_capture("failed session/load was missing session_id"))?;
    replay.insert(
        "missing_session_load".to_owned(),
        json!({
            "session_id": session_id,
            "jsonrpc_error": {
                "code": -32000,
                "message": record.error_message().unwrap_or_else(|| "provider_error".to_owned())
            }
        }),
    );
    Ok(())
}

impl CommandRecord {
    fn error_message(&self) -> Option<String> {
        self.error
            .as_ref()
            .and_then(|value| value.get("message"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    }
}

fn consumer_sequence(records: &[CommandRecord]) -> Value {
    Value::Array(
        records
            .iter()
            .map(|record| {
                let mut operation = Map::new();
                operation.insert("command".to_owned(), json!(record.command));
                operation.insert("params".to_owned(), record.params.clone());
                operation.insert("expect_ok".to_owned(), json!(record.ok));
                if let Some(state) = snapshot_state(record) {
                    operation.insert("assert_snapshot_state".to_owned(), json!(state));
                }
                if let Some(error) = error_code(record) {
                    operation.insert("assert_error_code".to_owned(), json!(error));
                }
                Value::Object(operation)
            })
            .collect(),
    )
}

fn prompt_block(metadata: &ReplayMetadata, records: &[CommandRecord]) -> Result<Option<Value>> {
    let Some(record) = records
        .iter()
        .find(|record| record.command == "session/prompt")
    else {
        return Ok(None);
    };
    let chunks = agent_chunks_from_records(records)?;
    if chunks.is_empty() {
        return Err(invalid_capture(
            "session/prompt capture did not expose agent text chunks for explicit oracle assertion",
        ));
    }
    let prompt = record
        .params
        .get("prompt")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            format!(
                "Reply exactly: conduit-phase-2-replay-{} observed.",
                metadata.provider.as_str()
            )
        });
    Ok(Some(json!({
        "input": prompt,
        "agent_text_chunks": chunks,
        "stop_reason": record.result.get("stopReason").and_then(Value::as_str).unwrap_or("end_turn"),
        "chunk_delay_ms": 1
    })))
}

fn agent_chunks_from_records(records: &[CommandRecord]) -> Result<Vec<String>> {
    let snapshot_chunks = records
        .iter()
        .filter_map(|record| record.snapshot.as_ref())
        .filter_map(|snapshot| snapshot.get("last_prompt"))
        .filter_map(|prompt| prompt.get("agent_text_chunks"))
        .filter_map(Value::as_array)
        .next_back()
        .cloned()
        .unwrap_or_default();
    snapshot_chunks
        .iter()
        .map(|chunk| {
            chunk
                .as_str()
                .map(ToOwned::to_owned)
                .ok_or_else(|| invalid_capture("agent_text_chunks contained a non-string value"))
        })
        .collect()
}

fn subscribe_events(record: &CommandRecord) -> Result<Vec<Value>> {
    let events = record
        .result
        .get("events")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid_capture("events/subscribe response missing events"))?;
    Ok(events
        .iter()
        .map(|event| {
            json!({
                "kind": event.get("kind").cloned().unwrap_or(Value::Null),
                "provider": event.get("provider").cloned().unwrap_or(Value::Null),
                "session_id": event.get("session_id").cloned().unwrap_or(Value::Null),
                "payload": event.get("payload").cloned().unwrap_or_else(|| json!({}))
            })
        })
        .collect())
}

fn last_snapshot_before_subscribe(
    records: &[CommandRecord],
    subscribe_index: usize,
) -> Result<Value> {
    records[..subscribe_index]
        .iter()
        .rev()
        .find_map(|record| record.snapshot.clone())
        .ok_or_else(|| invalid_capture("no response snapshot before events/subscribe"))
}

fn first_session_id(records: &[CommandRecord]) -> Option<Value> {
    records
        .iter()
        .find_map(|record| record.result.get("sessionId").cloned())
}

fn replay_session_id(metadata: &ReplayMetadata) -> Value {
    json!(format!(
        "replay-{}-{}-session-1",
        metadata.provider.as_str(),
        metadata.scenario
    ))
}

fn expected_event_kinds(events: &[Value]) -> Value {
    Value::Array(
        events
            .iter()
            .filter_map(|event| event.get("kind").cloned())
            .collect(),
    )
}

fn snapshot_state(record: &CommandRecord) -> Option<&str> {
    record
        .snapshot
        .as_ref()
        .and_then(|snapshot| snapshot.get("connection_state"))
        .and_then(Value::as_str)
}

fn error_code(record: &CommandRecord) -> Option<&str> {
    record
        .error
        .as_ref()
        .and_then(|error| error.get("code"))
        .and_then(Value::as_str)
}

fn dynamic_ignored_fields() -> Vec<&'static str> {
    vec![
        "frame ids",
        "command ids",
        "timestamps",
        "event sequence values",
        "live ACP session ids",
        "cwd",
        "cwd/path/launcher resolved paths",
        "initialize elapsed diagnostics",
        "provider version",
        "transport diagnostics",
    ]
}

fn observation(metadata: &ReplayMetadata) -> Value {
    json!({
        "source_scenario": metadata.scenario,
        "raw_source_id": metadata.capture_id,
        "dynamic_ignored_fields": dynamic_ignored_fields(),
        "scrubbed_fields": [
            "cwd",
            "live ACP session ids",
            "frame ids",
            "command ids",
            "timestamps",
            "launcher paths",
            "provider-version paths",
            "local paths"
        ],
        "stable_assertions": [
            "provider",
            "connection_state",
            "event kind",
            "command result/error code",
            "session identity relations",
            "observed_via",
            "events/subscribe backlog"
        ],
        "raw_capture_safe_to_promote": false,
        "curated_replay_safe_to_promote": true,
        "provider_caveats": [
            "Official ACP SDK owns raw JSON-RPC transport; Conduit captures through the public WebSocket /api/session boundary."
        ],
        "blockers": metadata.blockers
    })
}

fn build_candidate_manifest(metadata: &ReplayMetadata) -> Value {
    json!({
        "schema": REPLAY_MANIFEST_SCHEMA,
        "provider": metadata.provider.as_str(),
        "scenarios": [{
            "name": metadata.scenario,
            "path": format!("{}/scenario.json", metadata.scenario),
            "capture_source": format!("capture://phase-2.2/{}", metadata.capture_id),
            "redaction_status": "candidate-public-repo-safe-structural-scrub",
            "stable_assertions": [
                "provider",
                "connection_state",
                "event kind",
                "command result/error code",
                "session identity relations",
                "events_subscribe_cursor_backlog"
            ]
        }]
    })
}

fn candidate_summary(metadata: &ReplayMetadata, events: &[Value]) -> String {
    format!(
        "# Replay Candidate Fixture\n\nProvider: `{}`\n\nScenario: `{}`\n\nRaw source id: `{}`\n\nExpected backlog events: `{}`\n\nPromotion status: `candidate-review-required`.\n",
        metadata.provider.as_str(),
        metadata.scenario,
        metadata.capture_id,
        events.len()
    )
}

struct Scrubber {
    provider: ProviderId,
    scenario: String,
    cwd: String,
    session_ids: BTreeMap<String, String>,
}

impl Scrubber {
    fn new(provider: ProviderId, scenario: &str, cwd: &str) -> Self {
        Self {
            provider,
            scenario: scenario.to_owned(),
            cwd: cwd.to_owned(),
            session_ids: BTreeMap::new(),
        }
    }

    fn collect_session_ids(&mut self, values: &[Value]) {
        for value in values {
            collect_session_id_values(value, &mut self.session_ids);
        }
        let mut index = 1;
        for replacement in self.session_ids.values_mut() {
            *replacement = format!(
                "replay-{}-{}-session-{index}",
                self.provider.as_str(),
                self.scenario
            );
            index += 1;
        }
    }

    fn scrub_value(&self, value: Value) -> Value {
        self.scrub_value_for_key(None, value)
    }

    fn scrub_value_for_key(&self, key: Option<&str>, value: Value) -> Value {
        match value {
            Value::Array(values) => Value::Array(
                values
                    .into_iter()
                    .map(|value| self.scrub_value_for_key(key, value))
                    .collect(),
            ),
            Value::Object(map) => self.scrub_object(map),
            Value::String(text) => Value::String(self.scrub_string(key, &text)),
            other => other,
        }
    }

    fn scrub_string(&self, key: Option<&str>, text: &str) -> String {
        if let Some(session_id) = self.session_ids.get(text) {
            return session_id.clone();
        }
        if key == Some("session_title") {
            return "/__private_title_omitted__".to_owned();
        }
        if key == Some("nextCursor") {
            return "/__private_sessions_cursor_omitted__".to_owned();
        }
        if key == Some("updatedAt") {
            return "/__dynamic_updated_at__".to_owned();
        }
        if key == Some("prompt") && !text.starts_with("Reply exactly: conduit-phase-2-replay-") {
            return "/__private_prompt_omitted__".to_owned();
        }
        if key == Some("cwd") {
            return "/__conduit_replay_cwd__".to_owned();
        }
        if text == self.cwd || looks_like_local_path(text) {
            return "/__dynamic_path__".to_owned();
        }
        if looks_like_secret(text) {
            return "/__secret_omitted__".to_owned();
        }
        replace_embedded_paths(text)
    }

    fn scrub_object(&self, map: Map<String, Value>) -> Value {
        let scrub_title = sessionish_object(&map);
        Value::Object(
            map.into_iter()
                .map(|(entry_key, value)| {
                    let scrub_key = if scrub_title && entry_key == "title" {
                        Some("session_title")
                    } else {
                        Some(entry_key.as_str())
                    };
                    let scrubbed = self.scrub_value_for_key(scrub_key, value);
                    (entry_key, scrubbed)
                })
                .collect(),
        )
    }
}

fn sessionish_object(map: &Map<String, Value>) -> bool {
    map.contains_key("title")
        && (map.contains_key("sessionId")
            || map.contains_key("session_id")
            || map.contains_key("cwd"))
}

fn collect_session_id_values(value: &Value, session_ids: &mut BTreeMap<String, String>) {
    match value {
        Value::Object(map) => {
            for (key, entry) in map {
                if session_key(key)
                    && let Some(session_id) = entry.as_str()
                {
                    session_ids.entry(session_id.to_owned()).or_default();
                }
                collect_session_id_values(entry, session_ids);
            }
        }
        Value::Array(values) => {
            for entry in values {
                collect_session_id_values(entry, session_ids);
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn session_key(key: &str) -> bool {
    matches!(
        key,
        "session_id" | "sessionId" | "acp_session_id" | "session_id_text"
    )
}

fn replace_embedded_paths(text: &str) -> String {
    text.split_whitespace()
        .map(|part| {
            if looks_like_local_path(part) {
                "/__dynamic_path__"
            } else {
                part
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn looks_like_local_path(text: &str) -> bool {
    text.starts_with("/srv/")
        || text.starts_with("/home/")
        || text.starts_with("/Users/")
        || text.starts_with("/tmp/")
}

fn looks_like_secret(text: &str) -> bool {
    text.starts_with("sk-")
        || text.starts_with("ghp_")
        || text.starts_with("xoxb-")
        || text.contains("-----BEGIN")
}

fn validate_raw_wire_contracts(frames: &[Value]) -> Result<()> {
    let bundle = load_locked_contract_bundle()?;
    let mut methods_by_id = BTreeMap::new();
    for envelope in frames.iter().filter_map(raw_wire_envelope) {
        if envelope.get("method").and_then(Value::as_str) == Some("session/cancel") {
            validate_locked_cancel_notification(&bundle, &envelope)?;
        } else if envelope.get("method").is_some() {
            let method = validate_locked_request_envelope(&bundle, &envelope)?;
            if let Some(id) = envelope_id(&envelope) {
                methods_by_id.insert(id, method);
            }
        } else if envelope.get("result").is_some() {
            validate_raw_response(&bundle, &methods_by_id, &envelope)?;
        }
    }
    Ok(())
}

fn validate_raw_response(
    bundle: &acp_contracts::ContractBundle,
    methods_by_id: &BTreeMap<String, LockedMethod>,
    envelope: &Value,
) -> Result<()> {
    let Some(id) = envelope_id(envelope) else {
        return Ok(());
    };
    let Some(method) = methods_by_id.get(&id).copied() else {
        return Ok(());
    };
    validate_locked_response_envelope(bundle, method, envelope)?;
    Ok(())
}

fn raw_wire_envelope(frame: &Value) -> Option<Value> {
    if frame
        .get("event")
        .and_then(|event| event.get("kind"))
        .and_then(Value::as_str)
        != Some("raw_wire_event_captured")
    {
        return None;
    }
    let payload = frame
        .get("event")?
        .get("payload")?
        .get("payload")?
        .as_str()?;
    serde_json::from_str(payload).ok()
}

fn envelope_id(envelope: &Value) -> Option<String> {
    let id = envelope.get("id")?;
    if let Some(value) = id.as_u64() {
        return Some(value.to_string());
    }
    id.as_str().map(ToOwned::to_owned)
}
