//! Support code for the ACP replay integration test.

use super::REPLAY_PROVIDER_SCRIPT;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use std::error::Error;
use std::ffi::OsString;
use std::fs::{create_dir_all, read_to_string, remove_dir_all, set_permissions, write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

pub(crate) type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
pub(crate) type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub(crate) async fn assert_snapshot_agent_chunks(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    scenario: &Value,
    event_frames: &mut Vec<Value>,
) -> TestResult<Value> {
    let provider = run.provider;
    let snapshot = dispatch(socket, run, "snapshot/get", json!({}), event_frames).await?;
    assert_response_ok(&snapshot)?;
    assert_snapshot_provider(&snapshot, provider)?;
    assert_agent_chunks(&snapshot, expected_chunks(scenario)?)?;
    Ok(response_snapshot(&snapshot)?.clone())
}

pub(crate) async fn assert_subscribe_backlog(
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

pub(crate) async fn assert_subscribe_backlog_matches(
    socket: &mut TestSocket,
    run: &mut ReplayRun<'_>,
    event_frames: &mut Vec<Value>,
    expected_event_kinds: &[String],
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
    assert_event_kind_strings(&backlog_frames, expected_event_kinds)?;
    Ok(backlog_frames)
}

pub(crate) async fn assert_replay_disconnect(
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

pub(crate) struct TempWorkspace {
    pub(crate) path: PathBuf,
    pub(crate) provider_script: PathBuf,
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

pub(crate) struct ReplayProvider {
    pub(crate) id: &'static str,
    pub(crate) executable: &'static str,
}

pub(crate) struct ReplayRun<'a> {
    pub(crate) provider: &'a str,
    pub(crate) sequence: usize,
}

impl<'a> ReplayRun<'a> {
    pub(crate) fn new(provider: &'a str) -> Self {
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

pub(crate) fn replay_providers() -> [ReplayProvider; 3] {
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

pub(crate) fn prepare_replay_provider(provider_executable_name: &str) -> TestResult<TempWorkspace> {
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

pub(crate) struct ServiceConfig<'a> {
    pub(crate) port: u16,
    pub(crate) fixture: &'a Path,
    pub(crate) provider_script: &'a Path,
    pub(crate) shim_root: &'a Path,
}

pub(crate) struct ServiceProcess {
    child: Child,
}

impl ServiceProcess {
    pub(crate) fn start(config: ServiceConfig<'_>) -> TestResult<Self> {
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

    pub(crate) fn stop(&mut self) -> TestResult<()> {
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

pub(crate) async fn connect_to_service(port: u16) -> TestResult<TestSocket> {
    let url = format!("ws://127.0.0.1:{port}/api/session");
    for _attempt in 0..100 {
        match connect_async(&url).await {
            Ok((socket, _response)) => return Ok(socket),
            Err(_error) => tokio::time::sleep(Duration::from_millis(50)).await,
        }
    }
    Err(format!("service did not accept websocket connections at {url}").into())
}

pub(crate) async fn dispatch(
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

pub(crate) async fn read_events_until(
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

pub(crate) async fn next_frame(socket: &mut TestSocket) -> TestResult<Value> {
    let Some(message) = tokio::time::timeout(Duration::from_secs(10), socket.next()).await? else {
        return Err("websocket closed before next frame".into());
    };
    let message = message?;
    let Message::Text(text) = message else {
        return Err("websocket frame was not text".into());
    };
    Ok(serde_json::from_str(&text)?)
}

pub(crate) fn assert_frame_correlation(frame: &Value, expected_id: &str) -> TestResult<()> {
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

pub(crate) fn assert_response_ok(frame: &Value) -> TestResult<()> {
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

pub(crate) fn assert_response_error(frame: &Value, operation: &Value) -> TestResult<()> {
    if frame
        .get("response")
        .and_then(|response| response.get("ok"))
        .and_then(Value::as_bool)
        != Some(false)
    {
        return Err(format!("response was not an error: {frame}").into());
    }
    if let Some(expected_code) = operation.get("assert_error_code").and_then(Value::as_str) {
        let actual_code = frame
            .get("response")
            .and_then(|response| response.get("error"))
            .and_then(|error| error.get("code"))
            .and_then(Value::as_str);
        if actual_code != Some(expected_code) {
            return Err(format!("expected error code {expected_code}, got {actual_code:?}").into());
        }
    }
    Ok(())
}

pub(crate) fn assert_snapshot_state(frame: &Value, expected: &str) -> TestResult<()> {
    let state = response_snapshot(frame)?
        .get("connection_state")
        .and_then(Value::as_str);
    if state == Some(expected) {
        return Ok(());
    }
    Err(format!("expected snapshot state {expected}, got {state:?}").into())
}

pub(crate) fn assert_snapshot_provider(frame: &Value, expected: &str) -> TestResult<()> {
    let provider = response_snapshot(frame)?
        .get("provider")
        .and_then(Value::as_str);
    if provider == Some(expected) {
        return Ok(());
    }
    Err(format!("expected snapshot provider {expected}, got {provider:?}").into())
}

pub(crate) fn assert_operation_expectations(
    frame: &Value,
    provider: &str,
    scenario: &Value,
    operation: &Value,
) -> TestResult<()> {
    if let Some(expected_state) = operation
        .get("assert_snapshot_state")
        .and_then(Value::as_str)
    {
        assert_snapshot_state(frame, expected_state)?;
    }
    if let Some(expected_session) = operation
        .get("assert_list_contains_session")
        .and_then(Value::as_str)
    {
        assert_list_contains_session(frame, expected_session)?;
    }
    if let Some(excluded_session) = operation
        .get("assert_list_excludes_session")
        .and_then(Value::as_str)
    {
        assert_list_excludes_session(frame, excluded_session)?;
    }
    if let Some(expected_observed_via) = operation
        .get("assert_snapshot_observed_via")
        .and_then(Value::as_str)
    {
        let session_id = scenario
            .get("session")
            .and_then(|session| session.get("session_id"))
            .and_then(Value::as_str)
            .ok_or("scenario was missing session.session_id")?;
        assert_snapshot_observed_via(frame, provider, session_id, expected_observed_via)?;
    }
    Ok(())
}

pub(crate) fn assert_list_contains_session(
    frame: &Value,
    expected_session: &str,
) -> TestResult<()> {
    let contains = response_result(frame)?
        .get("sessions")
        .and_then(Value::as_array)
        .ok_or("session/list result did not include sessions")?
        .iter()
        .any(|session| session_id_value(session) == Some(expected_session));
    if contains {
        return Ok(());
    }
    Err(format!("session/list did not contain {expected_session}: {frame}").into())
}

pub(crate) fn assert_list_excludes_session(
    frame: &Value,
    excluded_session: &str,
) -> TestResult<()> {
    let contains = response_result(frame)?
        .get("sessions")
        .and_then(Value::as_array)
        .ok_or("session/list result did not include sessions")?
        .iter()
        .any(|session| session_id_value(session) == Some(excluded_session));
    if !contains {
        return Ok(());
    }
    Err(format!("session/list unexpectedly contained {excluded_session}: {frame}").into())
}

pub(crate) fn session_id_value(session: &Value) -> Option<&str> {
    session
        .get("sessionId")
        .or_else(|| session.get("session_id"))
        .and_then(Value::as_str)
}

pub(crate) fn assert_snapshot_observed_via(
    frame: &Value,
    provider: &str,
    session_id: &str,
    expected_observed_via: &str,
) -> TestResult<()> {
    let found = response_snapshot(frame)?
        .get("live_sessions")
        .and_then(Value::as_array)
        .ok_or("snapshot did not include live_sessions")?
        .iter()
        .any(|session| {
            session
                .get("identity")
                .and_then(|identity| identity.get("provider"))
                .and_then(Value::as_str)
                == Some(provider)
                && session
                    .get("identity")
                    .and_then(|identity| identity.get("acp_session_id"))
                    .and_then(Value::as_str)
                    == Some(session_id)
                && session.get("observed_via").and_then(Value::as_str)
                    == Some(expected_observed_via)
        });
    if found {
        return Ok(());
    }
    Err(format!(
        "snapshot did not contain {provider}/{session_id} observed via {expected_observed_via}: {frame}"
    )
    .into())
}

pub(crate) fn assert_agent_chunks(frame: &Value, expected: Vec<String>) -> TestResult<()> {
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

pub(crate) fn assert_event_kinds(frames: &[Value], expected: &[&str]) -> TestResult<()> {
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

pub(crate) fn assert_event_kind_strings(frames: &[Value], expected: &[String]) -> TestResult<()> {
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

pub(crate) fn assert_no_duplicate_live_backlog(
    backlog: &[Value],
    live: &[Value],
) -> TestResult<()> {
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

pub(crate) fn event_sequence(frame: &Value) -> TestResult<u64> {
    frame
        .get("event")
        .and_then(|event| event.get("sequence"))
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("event frame was missing sequence: {frame}").into())
}

pub(crate) fn backlog_count(frame: &Value) -> TestResult<usize> {
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

pub(crate) fn response_result(frame: &Value) -> TestResult<&Value> {
    frame
        .get("response")
        .and_then(|response| response.get("result"))
        .ok_or_else(|| format!("response frame was missing result: {frame}").into())
}

pub(crate) fn response_snapshot(frame: &Value) -> TestResult<&Value> {
    frame
        .get("response")
        .and_then(|response| response.get("snapshot"))
        .ok_or_else(|| format!("response frame was missing snapshot: {frame}").into())
}

pub(crate) fn response_snapshot_value(frame: &Value) -> Option<&Value> {
    frame
        .get("response")
        .and_then(|response| response.get("snapshot"))
}

pub(crate) fn expected_chunks(scenario: &Value) -> TestResult<Vec<String>> {
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

pub(crate) fn expected_event_kind_strings(scenario: &Value) -> TestResult<Vec<String>> {
    scenario
        .get("expected_event_kinds")
        .and_then(Value::as_array)
        .ok_or("scenario was missing expected_event_kinds")?
        .iter()
        .map(|kind| kind.as_str().map(ToOwned::to_owned))
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| "expected_event_kinds contained a non-string value".into())
}

pub(crate) fn read_json(path: &Path) -> TestResult<Value> {
    Ok(serde_json::from_str(&read_to_string(path)?)?)
}

pub(crate) fn fixture_paths(provider: &str) -> TestResult<Vec<PathBuf>> {
    let replay_root = service_root()?.join(format!("testdata/providers/{provider}/replay"));
    let manifest = read_json(&replay_root.join("manifest.json"))?;
    manifest
        .get("scenarios")
        .and_then(Value::as_array)
        .ok_or("replay manifest was missing scenarios")?
        .iter()
        .map(|scenario| {
            let path = scenario
                .get("path")
                .and_then(Value::as_str)
                .ok_or("replay manifest scenario was missing path")?;
            Ok(replay_root.join(path))
        })
        .collect()
}

pub(crate) fn service_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(root.to_path_buf())
}

pub(crate) fn service_bin_path() -> TestResult<PathBuf> {
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

pub(crate) fn available_port() -> TestResult<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

pub(crate) fn path_with_shim(shim_root: &Path) -> TestResult<OsString> {
    let existing = std::env::var_os("PATH").ok_or("PATH was not set")?;
    let paths = std::iter::once(shim_root.to_path_buf()).chain(std::env::split_paths(&existing));
    Ok(std::env::join_paths(paths)?)
}

#[cfg(unix)]
pub(crate) fn mark_executable(path: &Path) -> TestResult<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
pub(crate) fn mark_executable(_path: &Path) -> TestResult<()> {
    Ok(())
}
