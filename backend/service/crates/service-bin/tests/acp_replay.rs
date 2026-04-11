//! Integration test for curated ACP replay fixtures through `service-bin serve`.

use acp_contracts as _;
use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use app_api as _;
use axum as _;
use futures_util::{SinkExt, StreamExt};
use regex as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime as _;
use std::error::Error;
use std::ffi::OsString;
use std::fs::{create_dir_all, read_to_string, remove_dir_all, set_permissions, write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror as _;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};
use tower_http as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

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
let cwd = scenario.session.cwd;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function error(id, message) {
  send({ jsonrpc: '2.0', id, error: { code: -32601, message } });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    respond(message.id, { sessionId });
    return;
  }
  if (message.method === 'session/list') {
    respond(message.id, { sessions: [{ sessionId, cwd }] });
    return;
  }
  if (message.method === 'session/load') {
    respond(message.id, {});
    return;
  }
  if (message.method === 'session/prompt') {
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
    for provider in replay_providers() {
        let fixture = fixture_path(provider.id)?;
        let scenario = read_json(&fixture)?;
        let workspace = prepare_replay_provider(provider.executable)?;
        let port = available_port()?;
        let mut server = ServiceProcess::start(ServiceConfig {
            port,
            fixture: &fixture,
            provider_script: &workspace.provider_script,
            shim_root: &workspace.path,
        })?;
        let mut socket = connect_to_service(port).await?;
        exercise_replay_sequence(&mut socket, provider.id, &scenario).await?;
        server.stop()?;
    }
    Ok(())
}

async fn exercise_replay_sequence(
    socket: &mut TestSocket,
    provider: &str,
    scenario: &Value,
) -> TestResult<()> {
    let mut event_frames = Vec::new();
    let mut run = ReplayRun::new(provider);

    let initialize = dispatch(socket, &mut run, "initialize", json!({}), &mut event_frames).await?;
    assert_response_ok(&initialize)?;
    assert_snapshot_state(&initialize, "ready")?;
    assert_snapshot_provider(&initialize, provider)?;

    let session_id = create_replay_session(socket, &mut run, &mut event_frames).await?;
    prompt_replay_session(socket, &mut run, scenario, &session_id, &mut event_frames).await?;
    assert_snapshot_agent_chunks(socket, &mut run, scenario, &mut event_frames).await?;
    let backlog_frames = assert_subscribe_backlog(socket, &mut run, &mut event_frames).await?;
    assert_replay_disconnect(socket, &mut run, &mut event_frames, &backlog_frames).await
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

async fn assert_snapshot_agent_chunks(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    scenario: &Value,
    event_frames: &mut Vec<Value>,
) -> TestResult<()> {
    let provider = run.provider;
    let snapshot = dispatch(socket, run, "snapshot/get", json!({}), event_frames).await?;
    assert_response_ok(&snapshot)?;
    assert_snapshot_provider(&snapshot, provider)?;
    assert_agent_chunks(&snapshot, expected_chunks(scenario)?)
}

async fn assert_subscribe_backlog(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    event_frames: &mut Vec<Value>,
) -> TestResult<Vec<Value>> {
    let subscribed = dispatch(
        socket,
        run,
        "events/subscribe",
        json!({ "after_sequence": 0 }),
        event_frames,
    )
    .await?;
    assert_response_ok(&subscribed)?;
    let backlog_count = backlog_count(&subscribed)?;
    let before_backlog_frames = event_frames.len();
    read_events_until(socket, event_frames, before_backlog_frames + backlog_count).await?;
    let backlog_frames = event_frames[before_backlog_frames..].to_vec();
    assert_event_kinds(
        &backlog_frames,
        &[
            "provider_connected",
            "session_observed",
            "prompt_started",
            "prompt_update_observed",
            "prompt_completed",
        ],
    )?;
    Ok(backlog_frames)
}

async fn assert_replay_disconnect(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    event_frames: &mut Vec<Value>,
    backlog_frames: &[Value],
) -> TestResult<()> {
    let before_disconnect_frames = event_frames.len();
    let provider = run.provider;
    let disconnected =
        dispatch(socket, run, "provider/disconnect", json!({}), event_frames).await?;
    assert_response_ok(&disconnected)?;
    assert_snapshot_state(&disconnected, "disconnected")?;
    assert_snapshot_provider(&disconnected, provider)?;
    read_events_until(socket, event_frames, before_disconnect_frames + 1).await?;
    assert_event_kinds(
        &event_frames[before_disconnect_frames..],
        &["provider_disconnected"],
    )?;
    assert_no_duplicate_live_backlog(backlog_frames, &event_frames[before_disconnect_frames..])
}

struct TempWorkspace {
    path: PathBuf,
    provider_script: PathBuf,
}

impl TempWorkspace {
    fn create() -> TestResult<Self> {
        let suffix = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let path = std::env::temp_dir().join(format!("conduit-acp-replay-{suffix}"));
        create_dir_all(&path)?;
        let provider_script = path.join("replay-provider.mjs");
        Ok(Self {
            path,
            provider_script,
        })
    }
}

impl Drop for TempWorkspace {
    fn drop(&mut self) {
        let _result = remove_dir_all(&self.path);
    }
}

struct ReplayProvider {
    id: &'static str,
    executable: &'static str,
}

struct ReplayRun<'a> {
    provider: &'a str,
    sequence: usize,
}

impl<'a> ReplayRun<'a> {
    fn new(provider: &'a str) -> Self {
        Self {
            provider,
            sequence: 0,
        }
    }

    fn next_sequence(&mut self) -> usize {
        self.sequence += 1;
        self.sequence
    }
}

fn replay_providers() -> [ReplayProvider; 3] {
    [
        ReplayProvider {
            id: "codex",
            executable: "codex-acp",
        },
        ReplayProvider {
            id: "copilot",
            executable: "copilot",
        },
        ReplayProvider {
            id: "claude",
            executable: "claude-agent-acp",
        },
    ]
}

fn prepare_replay_provider(provider_executable_name: &str) -> TestResult<TempWorkspace> {
    let workspace = TempWorkspace::create()?;
    let provider_executable = workspace.path.join(provider_executable_name);
    write(&workspace.provider_script, REPLAY_PROVIDER_SCRIPT)?;
    write(
        &provider_executable,
        "#!/usr/bin/env sh\nexec node \"$CONDUIT_REPLAY_PROVIDER_SCRIPT\"\n",
    )?;
    mark_executable(&provider_executable)?;
    Ok(workspace)
}

struct ServiceConfig<'a> {
    port: u16,
    fixture: &'a Path,
    provider_script: &'a Path,
    shim_root: &'a Path,
}

struct ServiceProcess {
    child: Child,
}

impl ServiceProcess {
    fn start(config: ServiceConfig<'_>) -> TestResult<Self> {
        let child = Command::new(service_bin_path()?)
            .arg("serve")
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(config.port.to_string())
            .env("PATH", path_with_shim(config.shim_root)?)
            .env("CONDUIT_ACP_REPLAY_FIXTURE", config.fixture)
            .env("CONDUIT_REPLAY_PROVIDER_SCRIPT", config.provider_script)
            .env_remove("ANTHROPIC_API_KEY")
            .env_remove("CLAUDE_API_KEY")
            .env_remove("CODEX_API_KEY")
            .env_remove("OPENAI_API_KEY")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        Ok(Self { child })
    }

    fn stop(&mut self) -> TestResult<()> {
        if self.child.try_wait()?.is_none() {
            self.child.kill()?;
            let _status = self.child.wait()?;
        }
        Ok(())
    }
}

impl Drop for ServiceProcess {
    fn drop(&mut self) {
        let _result = self.stop();
    }
}

async fn connect_to_service(port: u16) -> TestResult<TestSocket> {
    let url = format!("ws://127.0.0.1:{port}/api/session");
    for _attempt in 0..100 {
        match connect_async(&url).await {
            Ok((socket, _response)) => return Ok(socket),
            Err(_error) => tokio::time::sleep(Duration::from_millis(50)).await,
        }
    }
    Err(format!("service did not accept websocket connections at {url}").into())
}

async fn dispatch(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    command: &str,
    params: Value,
    event_frames: &mut Vec<Value>,
) -> TestResult<Value> {
    let sequence = run.next_sequence();
    let id = format!("replay-{sequence}-{}", command.replace('/', "-"));
    let frame = json!({
        "v": 1,
        "type": "command",
        "id": id,
        "command": {
            "id": format!("{id}-command"),
            "command": command,
            "provider": run.provider,
            "params": params,
        },
    });
    socket.send(Message::Text(frame.to_string().into())).await?;
    loop {
        let value = next_frame(socket).await?;
        match value.get("type").and_then(Value::as_str) {
            Some("event") => event_frames.push(value),
            Some("response") => {
                assert_frame_correlation(&value, &id)?;
                return Ok(value);
            }
            _ => return Err(format!("unexpected websocket frame {value}").into()),
        }
    }
}

async fn read_events_until(
    socket: &mut TestSocket,
    event_frames: &mut Vec<Value>,
    target_len: usize,
) -> TestResult<()> {
    while event_frames.len() < target_len {
        let value = next_frame(socket).await?;
        if value.get("type").and_then(Value::as_str) != Some("event") {
            return Err(format!("expected event frame, got {value}").into());
        }
        event_frames.push(value);
    }
    Ok(())
}

async fn next_frame(socket: &mut TestSocket) -> TestResult<Value> {
    let Some(message) = tokio::time::timeout(Duration::from_secs(10), socket.next()).await? else {
        return Err("websocket closed before next frame".into());
    };
    let message = message?;
    let Message::Text(text) = message else {
        return Err("websocket frame was not text".into());
    };
    Ok(serde_json::from_str(&text)?)
}

fn assert_frame_correlation(frame: &Value, expected_id: &str) -> TestResult<()> {
    let frame_id = frame.get("id").and_then(Value::as_str);
    let response_id = frame
        .get("response")
        .and_then(|response| response.get("id"))
        .and_then(Value::as_str);
    if frame_id == Some(expected_id) && response_id == Some(expected_id) {
        return Ok(());
    }
    Err(format!("frame correlation failed for {frame}").into())
}

fn assert_response_ok(frame: &Value) -> TestResult<()> {
    if frame
        .get("response")
        .and_then(|response| response.get("ok"))
        .and_then(Value::as_bool)
        == Some(true)
    {
        return Ok(());
    }
    Err(format!("response was not ok: {frame}").into())
}

fn assert_snapshot_state(frame: &Value, expected: &str) -> TestResult<()> {
    let state = response_snapshot(frame)?
        .get("connection_state")
        .and_then(Value::as_str);
    if state == Some(expected) {
        return Ok(());
    }
    Err(format!("expected snapshot state {expected}, got {state:?}").into())
}

fn assert_snapshot_provider(frame: &Value, expected: &str) -> TestResult<()> {
    let provider = response_snapshot(frame)?
        .get("provider")
        .and_then(Value::as_str);
    if provider == Some(expected) {
        return Ok(());
    }
    Err(format!("expected snapshot provider {expected}, got {provider:?}").into())
}

fn assert_agent_chunks(frame: &Value, expected: Vec<String>) -> TestResult<()> {
    let chunks = response_snapshot(frame)?
        .get("last_prompt")
        .and_then(|prompt| prompt.get("agent_text_chunks"))
        .and_then(Value::as_array)
        .ok_or("snapshot was missing last_prompt.agent_text_chunks")?
        .iter()
        .map(|chunk| chunk.as_str().map(ToOwned::to_owned))
        .collect::<Option<Vec<_>>>()
        .ok_or("agent_text_chunks contained a non-string value")?;
    if chunks == expected {
        return Ok(());
    }
    Err(format!("unexpected agent chunks {chunks:?}").into())
}

fn assert_event_kinds(frames: &[Value], expected: &[&str]) -> TestResult<()> {
    let kinds = frames
        .iter()
        .map(|frame| {
            frame
                .get("event")
                .and_then(|event| event.get("kind"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect::<Option<Vec<_>>>()
        .ok_or("event frame was missing kind")?;
    if kinds == expected {
        return Ok(());
    }
    Err(format!("expected event kinds {expected:?}, got {kinds:?}").into())
}

fn assert_no_duplicate_live_backlog(backlog: &[Value], live: &[Value]) -> TestResult<()> {
    if live.len() != 1 {
        return Err(format!("expected one live event after backlog, got {}", live.len()).into());
    }
    let live_sequence = event_sequence(&live[0])?;
    if backlog
        .iter()
        .filter_map(|frame| event_sequence(frame).ok())
        .any(|sequence| sequence == live_sequence)
    {
        return Err("live event duplicated a backlog event sequence".into());
    }
    Ok(())
}

fn event_sequence(frame: &Value) -> TestResult<u64> {
    frame
        .get("event")
        .and_then(|event| event.get("sequence"))
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("event frame was missing sequence: {frame}").into())
}

fn backlog_count(frame: &Value) -> TestResult<usize> {
    let events = response_result(frame)?
        .get("events")
        .and_then(Value::as_array)
        .ok_or("events/subscribe response did not include events")?;
    if response_result(frame)?
        .get("next_sequence")
        .and_then(Value::as_u64)
        != Some(events.len() as u64)
    {
        return Err(format!("unexpected events/subscribe cursor in {frame}").into());
    }
    Ok(events.len())
}

fn response_result(frame: &Value) -> TestResult<&Value> {
    frame
        .get("response")
        .and_then(|response| response.get("result"))
        .ok_or_else(|| format!("response frame was missing result: {frame}").into())
}

fn response_snapshot(frame: &Value) -> TestResult<&Value> {
    frame
        .get("response")
        .and_then(|response| response.get("snapshot"))
        .ok_or_else(|| format!("response frame was missing snapshot: {frame}").into())
}

fn expected_chunks(scenario: &Value) -> TestResult<Vec<String>> {
    scenario
        .get("prompt")
        .and_then(|prompt| prompt.get("agent_text_chunks"))
        .and_then(Value::as_array)
        .ok_or("scenario was missing prompt.agent_text_chunks")?
        .iter()
        .map(|chunk| chunk.as_str().map(ToOwned::to_owned))
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| "prompt.agent_text_chunks contained a non-string value".into())
}

fn read_json(path: &Path) -> TestResult<Value> {
    Ok(serde_json::from_str(&read_to_string(path)?)?)
}

fn fixture_path(provider: &str) -> TestResult<PathBuf> {
    Ok(service_root()?.join(format!(
        "testdata/providers/{provider}/replay/prompt-agent-text/scenario.json"
    )))
}

fn service_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(root.to_path_buf())
}

fn service_bin_path() -> TestResult<PathBuf> {
    if let Some(path) = std::env::var_os("CARGO_BIN_EXE_service-bin") {
        return Ok(PathBuf::from(path));
    }
    let current = std::env::current_exe()?;
    let Some(debug_root) = current.ancestors().nth(2) else {
        return Err(format!(
            "could not resolve service-bin path from {}",
            current.display()
        )
        .into());
    };
    Ok(debug_root.join(format!("service-bin{}", std::env::consts::EXE_SUFFIX)))
}

fn available_port() -> TestResult<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

fn path_with_shim(shim_root: &Path) -> TestResult<OsString> {
    let existing = std::env::var_os("PATH").ok_or("PATH was not set")?;
    let paths = std::iter::once(shim_root.to_path_buf()).chain(std::env::split_paths(&existing));
    Ok(std::env::join_paths(paths)?)
}

#[cfg(unix)]
fn mark_executable(path: &Path) -> TestResult<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn mark_executable(_path: &Path) -> TestResult<()> {
    Ok(())
}
