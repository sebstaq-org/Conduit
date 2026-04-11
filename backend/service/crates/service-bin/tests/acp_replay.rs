//! Integration test for curated ACP replay fixtures through `service-bin serve`.

use acp_contracts as _;
use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use app_api as _;
use axum as _;
use directories as _;
use regex as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime as _;
use session_store as _;
use thiserror as _;
use tower_http as _;

#[path = "acp_replay/fixtures.rs"]
mod fixtures;
#[path = "acp_replay/history_window.rs"]
mod history_window;
#[path = "acp_replay/load_replay.rs"]
mod load_replay;
#[path = "support/replay_oracle.rs"]
mod oracle;
#[path = "acp_replay/support.rs"]
mod support;

use fixtures::*;
use oracle::*;
use support::*;

const REPLAY_PROVIDER_SCRIPT: &str = r#"
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const fixturePath = process.env.CONDUIT_ACP_REPLAY_FIXTURE;
if (!fixturePath) {
  process.stderr.write('CONDUIT_ACP_REPLAY_FIXTURE is required\n');
  process.exit(2);
}

const scenario = JSON.parse(readFileSync(fixturePath, 'utf8'));
const sessionId = scenario.session.session_id;
const missingSessionId = scenario.replay?.missing_session_load?.session_id;
let cwd = scenario.session.cwd;
const loadedReplayBySession = new Map();

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function error(id, message, code = -32601) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionIdText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    return value.sessionId ?? value.session_id ?? value.id;
  }
  return undefined;
}

function materialize(value) {
  if (typeof value === 'string') {
    return value
      .replaceAll('/__conduit_replay_cwd__', cwd)
      .replaceAll('${session_id}', sessionId)
      .replaceAll('${missing_session_id}', missingSessionId ?? 'replay-missing-session');
  }
  if (Array.isArray(value)) {
    return value.map(materialize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, materialize(entry)]));
  }
  return value;
}

function requireLoadRequestShape(message) {
  if (typeof message.params?.sessionId !== 'string') {
    error(message.id, 'session/load request missing sessionId', -32602);
    return false;
  }
  if (typeof message.params?.cwd !== 'string' || !message.params.cwd.startsWith('/')) {
    error(message.id, 'session/load request missing absolute cwd', -32602);
    return false;
  }
  if (!Array.isArray(message.params?.mcpServers)) {
    error(message.id, 'session/load request missing mcpServers', -32602);
    return false;
  }
  return true;
}

function updateVariant(update) {
  return update?.sessionUpdate;
}

function updateText(update) {
  const content = update?.content;
  if (content?.type === 'text' && typeof content.text === 'string') {
    return content.text;
  }
  return '';
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireLoadedReplayContext(message) {
  const promptReplay = scenario.replay?.session_prompt;
  if (promptReplay?.requires_loaded_replay !== true) {
    return true;
  }
  const requestedSessionId = sessionIdText(message.params?.sessionId ?? message.params?.session_id) ?? sessionId;
  const replayUpdates = loadedReplayBySession.get(requestedSessionId) ?? [];
  if (replayUpdates.length === 0) {
    error(message.id, 'session/prompt missing loaded replay history', -32000);
    return false;
  }
  const expectedVariants = promptReplay.expected_history_variants ?? [];
  const actualVariants = replayUpdates.map(updateVariant);
  if (!arraysEqual(actualVariants, expectedVariants)) {
    error(message.id, `session/prompt loaded replay variants mismatch: ${JSON.stringify(actualVariants)}`, -32000);
    return false;
  }
  const replayText = replayUpdates.map(updateText).join('\n');
  for (const expectedText of promptReplay.expected_history_text_includes ?? []) {
    if (!replayText.includes(expectedText)) {
      error(message.id, `session/prompt loaded replay text missing: ${expectedText}`, -32000);
      return false;
    }
  }
  return true;
}

async function handle(message) {
  if (message.method === 'initialize') {
    respond(message.id, {
      protocolVersion: scenario.acp_protocol_version,
      agentCapabilities: scenario.initialize.capabilities,
      authMethods: scenario.initialize.auth_methods,
      agentInfo: scenario.initialize.agent_info,
    });
    return;
  }
  if (message.method === 'session/new') {
    cwd = message.params?.cwd ?? cwd;
    respond(message.id, materialize(scenario.replay?.session_new?.result ?? { sessionId }));
    return;
  }
  if (message.method === 'session/list') {
    respond(message.id, materialize(scenario.replay?.session_list?.result ?? { sessions: [{ sessionId, cwd }] }));
    return;
  }
  if (message.method === 'session/load') {
    if (!requireLoadRequestShape(message)) {
      return;
    }
    const requestedSessionId = sessionIdText(message.params?.sessionId ?? message.params?.session_id);
    if (missingSessionId && requestedSessionId === missingSessionId) {
      const replayError = scenario.replay.missing_session_load.jsonrpc_error;
      error(message.id, replayError.message, replayError.code);
      return;
    }
    const replayUpdates = [];
    for (const update of scenario.replay?.session_load?.replay_updates ?? []) {
      const replayUpdate = materialize(update);
      replayUpdates.push(replayUpdate);
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: requestedSessionId ?? sessionId,
          update: replayUpdate,
        },
      });
      await sleep(scenario.replay?.session_load?.replay_update_delay_ms ?? 0);
    }
    loadedReplayBySession.set(requestedSessionId ?? sessionId, replayUpdates);
    respond(message.id, materialize(scenario.replay?.session_load?.result ?? {}));
    return;
  }
  if (message.method === 'session/prompt') {
    if (!requireLoadedReplayContext(message)) {
      return;
    }
    const promptReplay = scenario.replay?.session_prompt;
    const promptSessionId = sessionIdText(message.params?.sessionId ?? message.params?.session_id) ?? sessionId;
    for (const update of promptReplay?.replay_updates ?? []) {
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: promptSessionId,
          update: materialize(update),
        },
      });
      await sleep(promptReplay?.replay_update_delay_ms ?? 0);
    }
    if (!scenario.prompt) {
      respond(message.id, materialize(scenario.replay?.session_prompt?.result ?? { stopReason: 'end_turn' }));
      return;
    }
    for (const text of scenario.prompt.agent_text_chunks) {
      send({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text },
          },
        },
      });
      await sleep(scenario.prompt.chunk_delay_ms);
    }
    respond(message.id, { stopReason: scenario.prompt.stop_reason });
    return;
  }
  if (message.method === 'session/cancel') {
    return;
  }
  error(message.id, `unsupported replay method: ${message.method}`);
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (line.trim().length === 0) {
    continue;
  }
  await handle(JSON.parse(line));
}
"#;

#[tokio::test]
async fn curated_acp_replay_drives_public_websocket_flow() -> TestResult<()> {
    for fixture in replay_fixtures()? {
        let scenario = read_json(&fixture.path)?;
        let workspace = prepare_replay_provider(fixture.provider_executable)?;
        let port = available_port()?;
        let mut server = ServiceProcess::start(ServiceConfig {
            port,
            fixture: &fixture.path,
            provider_script: &workspace.provider_script,
            shim_root: &workspace.path,
        })?;
        let mut socket = connect_to_service(port).await?;
        exercise_replay_sequence(&mut socket, &fixture.provider_id, &fixture.path, &scenario)
            .await?;
        server.stop()?;
    }
    Ok(())
}

async fn exercise_replay_sequence(
    socket: &mut TestSocket,
    provider: &str,
    fixture: &std::path::Path,
    scenario: &Value,
) -> TestResult<()> {
    if scenario.get("consumer_sequence").is_some() {
        return exercise_curated_sequence(socket, provider, fixture, scenario).await;
    }

    let mut event_frames = Vec::new();
    let mut run = ReplayRun::new(provider);

    let initialize = dispatch(socket, &mut run, "initialize", json!({}), &mut event_frames).await?;
    assert_response_ok(&initialize)?;
    assert_snapshot_state(&initialize, "ready")?;
    assert_snapshot_provider(&initialize, provider)?;

    let session_id = create_replay_session(socket, &mut run, &mut event_frames).await?;
    prompt_replay_session(socket, &mut run, scenario, &session_id, &mut event_frames).await?;
    let expected_snapshot =
        assert_snapshot_agent_chunks(socket, &mut run, scenario, &mut event_frames).await?;
    let backlog_frames =
        assert_subscribe_backlog(socket, &mut run, scenario, &mut event_frames).await?;
    assert_expected_oracles(fixture, scenario, &backlog_frames, &expected_snapshot)?;
    assert_replay_disconnect(socket, &mut run, &mut event_frames, &backlog_frames).await
}

async fn exercise_curated_sequence(
    socket: &mut TestSocket,
    provider: &str,
    fixture: &std::path::Path,
    scenario: &Value,
) -> TestResult<()> {
    let mut event_frames = Vec::new();
    let mut run = ReplayRun::new(provider);
    let mut expected_snapshot = None;
    let mut opened_session_id = None;
    let operations = scenario
        .get("consumer_sequence")
        .and_then(Value::as_array)
        .ok_or("scenario was missing consumer_sequence")?;

    for operation in operations {
        let command = operation
            .get("command")
            .and_then(Value::as_str)
            .ok_or("consumer_sequence operation was missing command")?;
        let params = operation
            .get("params")
            .cloned()
            .unwrap_or_else(|| json!({}));
        let params = materialize_curated_params(params, opened_session_id.as_deref())?;
        let response = dispatch(socket, &mut run, command, params, &mut event_frames).await?;
        let expect_ok = operation
            .get("expect_ok")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if expect_ok {
            assert_response_ok(&response)?;
            if response_snapshot_value(&response).is_some_and(|snapshot| !snapshot.is_null()) {
                assert_snapshot_provider(&response, provider)?;
            }
        } else {
            assert_response_error(&response, operation)?;
        }
        assert_operation_expectations(&response, provider, scenario, operation)?;
        if command == "session/open" && expect_ok {
            opened_session_id = Some(
                response_result(&response)?
                    .get("openSessionId")
                    .and_then(Value::as_str)
                    .ok_or("session/open result did not include openSessionId")?
                    .to_owned(),
            );
        }
        if let Some(snapshot) =
            response_snapshot_value(&response).filter(|snapshot| !snapshot.is_null())
        {
            expected_snapshot = Some(snapshot.clone());
        }
    }

    let expected_event_kinds = expected_event_kind_strings(scenario)?;
    let backlog_frames = assert_subscribe_backlog_matches(
        socket,
        &mut run,
        &mut event_frames,
        &expected_event_kinds,
    )
    .await?;
    let expected_snapshot = expected_snapshot
        .ok_or("scenario did not produce a response snapshot before events/subscribe")?;
    assert_expected_oracles(fixture, scenario, &backlog_frames, &expected_snapshot)?;
    assert_replay_disconnect(socket, &mut run, &mut event_frames, &backlog_frames).await
}

fn materialize_curated_params(value: Value, opened_session_id: Option<&str>) -> TestResult<Value> {
    match value {
        Value::String(text) if text == "$lastOpenSessionId" => opened_session_id
            .map(|id| Value::String(id.to_owned()))
            .ok_or_else(|| "$lastOpenSessionId used before session/open".into()),
        Value::String(text) => Ok(Value::String(text)),
        Value::Array(values) => values
            .into_iter()
            .map(|entry| materialize_curated_params(entry, opened_session_id))
            .collect::<TestResult<Vec<_>>>()
            .map(Value::Array),
        Value::Object(map) => map
            .into_iter()
            .map(|(key, entry)| {
                materialize_curated_params(entry, opened_session_id).map(|entry| (key, entry))
            })
            .collect::<TestResult<serde_json::Map<_, _>>>()
            .map(Value::Object),
        Value::Null | Value::Bool(_) | Value::Number(_) => Ok(value),
    }
}

async fn create_replay_session(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    event_frames: &mut Vec<Value>,
) -> TestResult<String> {
    let created = dispatch(
        socket,
        run,
        "session/new",
        json!({ "cwd": "/__conduit_replay_test_cwd__" }),
        event_frames,
    )
    .await?;
    assert_response_ok(&created)?;
    let session_id = response_result(&created)?
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or("session/new did not return sessionId")?
        .to_owned();
    Ok(session_id)
}

async fn prompt_replay_session(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    scenario: &Value,
    session_id: &str,
    event_frames: &mut Vec<Value>,
) -> TestResult<()> {
    let prompt = dispatch(
        socket,
        run,
        "session/prompt",
        json!({
            "session_id": session_id,
            "prompt": scenario["prompt"]["input"].clone(),
        }),
        event_frames,
    )
    .await?;
    assert_response_ok(&prompt)
}
