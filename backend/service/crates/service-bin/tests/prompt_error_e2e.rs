//! End-to-end coverage for surfacing failed prompt turns in session history.

use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use axum as _;
use base64 as _;
use directories as _;
use futures_util::{SinkExt, StreamExt};
use provider_fixture as _;
use rand_core as _;
use remote_access as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime as _;
use session_store as _;
use std::error::Error;
use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use telemetry_support as _;
use thiserror as _;
use time as _;
use tokio::net::TcpStream as TokioTcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};
use tower_http as _;
use tracing as _;
use tracing_subscriber as _;
use x25519_dalek as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
type SessionSocket = WebSocketStream<MaybeTlsStream<TokioTcpStream>>;

const INCIDENT_SESSION_ID: &str = "019dc6fa-c4eb-7480-9f21-4800245835a3";
const FIXTURE_SESSION_ID: &str = "e2e-codex-permission-error-0001";
const INCIDENT_ERROR: &str = "official ACP SDK error from codex during session/prompt";

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn prompt_provider_failure_is_visible_in_session_history() -> TestResult<()> {
    let server = PromptErrorServer::start()?;
    let mut socket = connect_session_socket(server.port()).await?;
    let open_session_id = create_session(&mut socket).await?;
    watch_session(&mut socket, &open_session_id).await?;
    assert_prompt_failure_visible(&mut socket, &open_session_id).await
}

struct PromptErrorServer {
    child: Child,
    home: PathBuf,
    fixtures: PathBuf,
    port: u16,
}

impl PromptErrorServer {
    fn start() -> TestResult<Self> {
        let home = test_dir("home")?;
        let fixtures = test_dir("fixtures")?;
        write_permission_error_fixture(&fixtures)?;
        let port = free_port()?;
        let child = spawn_serve(&home, &fixtures, port)?;
        wait_for_http(port)?;
        Ok(Self {
            child,
            home,
            fixtures,
            port,
        })
    }

    const fn port(&self) -> u16 {
        self.port
    }
}

impl Drop for PromptErrorServer {
    fn drop(&mut self) {
        cleanup_child(&mut self.child);
        cleanup_dir(&self.home);
        cleanup_dir(&self.fixtures);
    }
}

async fn create_session(socket: &mut SessionSocket) -> TestResult<String> {
    let created = send_command(
        socket,
        CommandSpec::new(
            "session-new",
            "session/new",
            "codex",
            json!({
            "cwd": "/repo",
            "limit": 40
            }),
        ),
    )
    .await?;
    Ok(created
        .pointer("/response/result/history/openSessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("session/new missing openSessionId: {created}"))?
        .to_owned())
}

async fn watch_session(socket: &mut SessionSocket, open_session_id: &str) -> TestResult<()> {
    assert_ok(
        &send_command(
            socket,
            CommandSpec::new(
                "session-watch",
                "session/watch",
                "all",
                json!({ "openSessionId": open_session_id }),
            ),
        )
        .await?,
    )
}

async fn assert_prompt_failure_visible(
    socket: &mut SessionSocket,
    open_session_id: &str,
) -> TestResult<()> {
    let prompt = send_command_collecting_timeline(
        socket,
        CommandSpec::new(
            "session-prompt",
            "session/prompt",
            "all",
            json!({
            "openSessionId": open_session_id,
            "prompt": incident_prompt()
            }),
        ),
        open_session_id,
    )
    .await?;
    assert_error_code(&prompt.response, "provider_error")?;
    if !prompt.saw_timeline_event {
        return Err("session/watch did not receive a timeline event for failed prompt".into());
    }

    let history = send_command(
        socket,
        CommandSpec::new(
            "session-history",
            "session/history",
            "all",
            json!({
            "openSessionId": open_session_id,
            "limit": 40
            }),
        ),
    )
    .await?;
    assert_turn_error_history(&history)
}

struct PromptResult {
    response: Value,
    saw_timeline_event: bool,
}

async fn connect_session_socket(port: u16) -> TestResult<SessionSocket> {
    let url = format!("ws://127.0.0.1:{port}/api/session");
    let (socket, _response) = connect_async(url).await?;
    Ok(socket)
}

struct CommandSpec {
    id: &'static str,
    command: &'static str,
    provider: &'static str,
    params: Value,
}

impl CommandSpec {
    const fn new(
        id: &'static str,
        command: &'static str,
        provider: &'static str,
        params: Value,
    ) -> Self {
        Self {
            id,
            command,
            provider,
            params,
        }
    }
}

async fn send_command(socket: &mut SessionSocket, spec: CommandSpec) -> TestResult<Value> {
    let id = spec.id;
    socket
        .send(Message::Text(command_text(spec).into()))
        .await?;
    read_response(socket, id).await
}

async fn send_command_collecting_timeline(
    socket: &mut SessionSocket,
    spec: CommandSpec,
    open_session_id: &str,
) -> TestResult<PromptResult> {
    let id = spec.id;
    socket
        .send(Message::Text(command_text(spec).into()))
        .await?;
    let mut saw_timeline_event = false;
    loop {
        let frame = read_frame(socket).await?;
        if timeline_event_matches(&frame, open_session_id) {
            saw_timeline_event = true;
        }
        if frame.get("type").and_then(Value::as_str) == Some("response")
            && frame.get("id").and_then(Value::as_str) == Some(id)
        {
            return Ok(PromptResult {
                response: frame,
                saw_timeline_event,
            });
        }
    }
}

async fn read_response(socket: &mut SessionSocket, id: &str) -> TestResult<Value> {
    loop {
        let frame = read_frame(socket).await?;
        if frame.get("type").and_then(Value::as_str) == Some("response")
            && frame.get("id").and_then(Value::as_str) == Some(id)
        {
            return Ok(frame);
        }
    }
}

async fn read_frame(socket: &mut SessionSocket) -> TestResult<Value> {
    let message = tokio::time::timeout(Duration::from_secs(5), socket.next()).await?;
    let Some(message) = message else {
        return Err("session socket closed".into());
    };
    let message = message?;
    let text = message
        .into_text()
        .map_err(|error| format!("expected text frame: {error}"))?;
    Ok(serde_json::from_str(&text)?)
}

fn command_text(spec: CommandSpec) -> String {
    json!({
        "v": 1,
        "type": "command",
        "id": spec.id,
        "command": {
            "id": spec.id,
            "command": spec.command,
            "provider": spec.provider,
            "params": spec.params
        }
    })
    .to_string()
}

fn timeline_event_matches(frame: &Value, open_session_id: &str) -> bool {
    frame.get("type").and_then(Value::as_str) == Some("event")
        && frame.pointer("/event/kind").and_then(Value::as_str) == Some("session_timeline_changed")
        && frame
            .pointer("/event/openSessionId")
            .and_then(Value::as_str)
            == Some(open_session_id)
}

fn assert_ok(frame: &Value) -> TestResult<()> {
    if frame.pointer("/response/ok").and_then(Value::as_bool) == Some(true) {
        return Ok(());
    }
    Err(format!("expected ok response, got {frame}").into())
}

fn assert_error_code(frame: &Value, expected: &str) -> TestResult<()> {
    if frame.pointer("/response/ok").and_then(Value::as_bool) == Some(false)
        && frame
            .pointer("/response/error/code")
            .and_then(Value::as_str)
            == Some(expected)
    {
        return Ok(());
    }
    Err(format!("expected {expected} response, got {frame}").into())
}

fn assert_turn_error_history(frame: &Value) -> TestResult<()> {
    assert_ok(frame)?;
    let items = frame
        .pointer("/response/result/items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("history missing items: {frame}"))?;
    let turn_error = items
        .iter()
        .find(|item| item.get("variant").and_then(Value::as_str) == Some("turn_error"))
        .ok_or_else(|| format!("history missing turn_error: {items:?}"))?;
    if turn_error.get("status").and_then(Value::as_str) != Some("failed") {
        return Err(format!("turn_error was not marked failed: {turn_error}").into());
    }
    if turn_error.pointer("/data/message").and_then(Value::as_str) != Some(INCIDENT_ERROR) {
        return Err(format!("turn_error missing incident error: {turn_error}").into());
    }
    if turn_error.pointer("/data/provider").and_then(Value::as_str) != Some("codex") {
        return Err(format!("turn_error missing provider: {turn_error}").into());
    }
    Ok(())
}

fn write_permission_error_fixture(root: &Path) -> TestResult<()> {
    write_initialize_fixture(root)?;
    write_session_new_fixture(root)?;
    write_session_prompt_failure_fixture(root)
}

fn write_initialize_fixture(root: &Path) -> TestResult<()> {
    let dir = root.join("codex/initialize/default");
    fs::create_dir_all(&dir)?;
    let source = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../../apps/e2e/fixtures/provider/codex/initialize/default/provider.raw.json");
    fs::copy(source, dir.join("provider.raw.json"))?;
    Ok(())
}

fn write_session_new_fixture(root: &Path) -> TestResult<()> {
    let dir = root.join("codex/session-new/default");
    fs::create_dir_all(&dir)?;
    fs::write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&json!({
            "sessionId": FIXTURE_SESSION_ID,
            "configOptions": [{
                "category": "mode",
                "currentValue": "default",
                "description": "Choose an approval and sandboxing preset for your session",
                "id": "mode",
                "name": "Approval Preset",
                "options": [
                    { "name": "Read Only", "value": "read-only" },
                    { "name": "Default", "value": "auto" },
                    { "name": "Full Access", "value": "full-access" }
                ],
                "type": "select"
            }],
            "modes": null,
            "models": null
        }))?,
    )?;
    Ok(())
}

fn write_session_prompt_failure_fixture(root: &Path) -> TestResult<()> {
    let dir = root
        .join("codex/session-prompt")
        .join(FIXTURE_SESSION_ID)
        .join("require-escalated-permission");
    fs::create_dir_all(&dir)?;
    fs::write(
        dir.join("manifest.json"),
        serde_json::to_string(&json!({
            "captureKind": "provider",
            "contractBoundary": "provider-acp",
            "curation": "Sanitized from local stage incident; prompt text normalized and no raw logs retained.",
            "operation": "session/prompt",
            "provider": "codex",
            "replacedFields": [
                "sessionId",
                "promptRequest.sessionId",
                "promptRequest.prompt.text",
                "incidentEvidence.lastToolCall.justification",
                "timestamp"
            ],
            "sessionId": FIXTURE_SESSION_ID,
            "sourceSessionId": INCIDENT_SESSION_ID,
            "timestamp": "2026-01-01T00:00:00Z"
        }))?,
    )?;
    fs::write(
        dir.join("failure.json"),
        serde_json::to_string(&json!({
            "operation": "session/prompt",
            "message": INCIDENT_ERROR,
            "promptRequest": {
                "sessionId": FIXTURE_SESSION_ID,
                "prompt": incident_prompt()
            },
            "incidentEvidence": {
                "lastToolCall": {
                    "cmd": "rtk git fetch origin main",
                    "sandbox_permissions": "require_escalated",
                    "justification": "Allow network access so Codex can fetch origin/main before analysis?",
                    "prefix_rule": ["rtk", "git", "fetch"]
                },
                "sourceSessionId": INCIDENT_SESSION_ID
            }
        }))?,
    )?;
    Ok(())
}

fn incident_prompt() -> Value {
    json!([{
        "type": "text",
        "text": "Investigate mobile popover positioning root cause and propose a fix."
    }])
}

fn spawn_serve(home: &Path, fixtures: &Path, port: u16) -> TestResult<Child> {
    let port_text = port.to_string();
    Ok(Command::new(service_bin())
        .args([
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            &port_text,
            "--provider-fixtures",
            fixtures.to_str().ok_or("fixture root is not utf8")?,
        ])
        .env("CONDUIT_HOME", home)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()?)
}

fn wait_for_http(port: u16) -> TestResult<()> {
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    while std::time::Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err("service did not start listening".into())
}

fn free_port() -> TestResult<u16> {
    Ok(std::net::TcpListener::bind("127.0.0.1:0")?
        .local_addr()?
        .port())
}

fn test_dir(label: &str) -> TestResult<PathBuf> {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let path =
        std::env::temp_dir().join(format!("conduit-service-bin-prompt-error-{label}-{nanos}"));
    fs::create_dir_all(&path)?;
    Ok(path)
}

fn cleanup_child(child: &mut Child) {
    let _kill = child.kill();
    let _wait = child.wait();
}

fn cleanup_dir(path: &Path) {
    let _remove = fs::remove_dir_all(path);
}

fn service_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_service-bin"))
}
