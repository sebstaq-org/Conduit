//! Live replay capture through the public consumer WebSocket boundary.

use super::{
    REPLAY_WORKFLOW_SCHEMA, ReplayMetadata, capture_id, default_raw_root,
    guard_not_committed_replay_root, invalid_capture,
};
use crate::artifact::{write_json, write_jsonl, write_text};
use crate::error::{Result, ServiceError};
use crate::proof::ProofWorkspace;
use crate::serve;
use crate::support::command_text;
use acp_discovery::ProviderId;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use service_runtime::{AppServiceFactory, ConsumerCommand};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

type ReplaySocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub(super) async fn capture(
    provider: ProviderId,
    scenario: &str,
    artifact_root: Option<PathBuf>,
    args: &[String],
) -> Result<()> {
    let root = artifact_root.unwrap_or_else(|| default_raw_root(provider, scenario));
    guard_not_committed_replay_root(&root)?;
    let proof = ProofWorkspace::prepare(provider, &root)?;
    let factory = AppServiceFactory::with_environment(proof.environment().clone());
    let server = serve::spawn_proof_server(factory).await?;
    let mut client = CaptureClient::connect(server.address).await?;
    let mut run = CaptureRun::new(provider, scenario, proof.cwd());
    drive_capture_scenario(&mut client, &mut run).await?;
    write_raw_capture(&proof, provider, scenario, &client, args)
}

struct CaptureRun {
    provider: ProviderId,
    scenario: String,
    cwd: PathBuf,
    session_id: Option<String>,
}

impl CaptureRun {
    fn new(provider: ProviderId, scenario: &str, cwd: PathBuf) -> Self {
        Self {
            provider,
            scenario: scenario.to_owned(),
            cwd,
            session_id: None,
        }
    }

    fn prompt(&self) -> String {
        format!(
            "Reply exactly: conduit-phase-2-replay-{} observed.",
            self.provider.as_str()
        )
    }

    fn missing_session_id(&self) -> String {
        format!("live-missing-{}-{}", self.provider.as_str(), self.scenario)
    }
}

struct CaptureClient {
    socket: ReplaySocket,
    sequence: usize,
    frames: Vec<Value>,
    responses: Vec<Value>,
    events: Vec<Value>,
}

impl CaptureClient {
    async fn connect(address: SocketAddr) -> Result<Self> {
        let url = format!("ws://{address}/api/session");
        let (socket, _response) = connect_async(url)
            .await
            .map_err(|error| invalid_capture(&format!("websocket connect failed: {error}")))?;
        Ok(Self {
            socket,
            sequence: 0,
            frames: Vec::new(),
            responses: Vec::new(),
            events: Vec::new(),
        })
    }

    async fn dispatch(
        &mut self,
        provider: ProviderId,
        command: &str,
        params: Value,
    ) -> Result<Value> {
        self.sequence += 1;
        let id = format!("capture-{}-{}", self.sequence, command.replace('/', "-"));
        let frame = json!({
            "v": 1,
            "type": "command",
            "id": id,
            "command": ConsumerCommand {
                id: id.clone(),
                command: command.to_owned(),
                provider: provider.as_str().to_owned(),
                params,
            },
        });
        self.frames.push(frame.clone());
        self.socket
            .send(Message::Text(frame.to_string().into()))
            .await
            .map_err(|error| invalid_capture(&format!("websocket send failed: {error}")))?;
        let response = self.read_response(&id).await?;
        self.read_subscribe_backlog(&response).await?;
        self.drain_events().await?;
        Ok(response)
    }

    async fn read_response(&mut self, id: &str) -> Result<Value> {
        loop {
            let frame = self.next_frame().await?;
            match frame.get("type").and_then(Value::as_str) {
                Some("response") => {
                    if frame.get("id").and_then(Value::as_str) != Some(id) {
                        return Err(invalid_capture("websocket response id mismatch"));
                    }
                    self.responses.push(frame.clone());
                    self.frames.push(frame.clone());
                    return Ok(frame);
                }
                Some("event") => self.record_event(frame),
                _ => return Err(invalid_capture("unexpected websocket frame")),
            }
        }
    }

    async fn read_subscribe_backlog(&mut self, response: &Value) -> Result<()> {
        let Some(events) = response
            .get("response")
            .and_then(|value| value.get("result"))
            .and_then(|value| value.get("events"))
            .and_then(Value::as_array)
        else {
            return Ok(());
        };
        for _event in events {
            let frame = self.next_frame().await?;
            if frame.get("type").and_then(Value::as_str) != Some("event") {
                return Err(invalid_capture(
                    "events/subscribe backlog frame was not an event",
                ));
            }
            self.record_event(frame);
        }
        Ok(())
    }

    async fn drain_events(&mut self) -> Result<()> {
        while let Ok(frame) =
            tokio::time::timeout(Duration::from_millis(50), self.next_frame()).await
        {
            self.record_event(frame?);
        }
        Ok(())
    }

    async fn next_frame(&mut self) -> Result<Value> {
        let Some(message) = self.socket.next().await else {
            return Err(invalid_capture("websocket closed before next frame"));
        };
        let message =
            message.map_err(|error| invalid_capture(&format!("websocket read failed: {error}")))?;
        let Message::Text(text) = message else {
            return Err(invalid_capture("websocket frame was not text"));
        };
        serde_json::from_str(&text).map_err(ServiceError::from)
    }

    fn record_event(&mut self, frame: Value) {
        self.events.push(frame.clone());
        self.frames.push(frame);
    }
}

async fn drive_capture_scenario(client: &mut CaptureClient, run: &mut CaptureRun) -> Result<()> {
    match run.scenario.as_str() {
        "prompt-agent-text" => capture_prompt_agent_text(client, run).await,
        "session-list-after-new" => capture_session_list_after_new(client, run).await,
        "session-load-known-session" => capture_session_load_known_session(client, run).await,
        "session-cancel" => capture_session_cancel(client, run).await,
        "reconnect-after-disconnect" => capture_reconnect_after_disconnect(client, run).await,
        "provider-error-load-missing-session" => {
            capture_provider_error_load_missing_session(client, run).await
        }
        _ => Err(invalid_capture(&format!(
            "unsupported replay capture scenario {}",
            run.scenario
        ))),
    }
}

async fn initialize(client: &mut CaptureClient, run: &CaptureRun) -> Result<Value> {
    client.dispatch(run.provider, "initialize", json!({})).await
}

async fn session_new(client: &mut CaptureClient, run: &mut CaptureRun) -> Result<Value> {
    let response = client
        .dispatch(
            run.provider,
            "session/new",
            json!({ "cwd": run.cwd.display().to_string() }),
        )
        .await?;
    run.session_id = session_id_from_response(&response);
    Ok(response)
}

async fn subscribe(client: &mut CaptureClient, run: &CaptureRun) -> Result<Value> {
    client
        .dispatch(
            run.provider,
            "events/subscribe",
            json!({ "after_sequence": 0 }),
        )
        .await
}

async fn capture_prompt_agent_text(client: &mut CaptureClient, run: &mut CaptureRun) -> Result<()> {
    initialize(client, run).await?;
    session_new(client, run).await?;
    let session_id = required_session_id(run)?;
    client
        .dispatch(
            run.provider,
            "session/prompt",
            json!({ "session_id": session_id, "prompt": run.prompt() }),
        )
        .await?;
    client
        .dispatch(run.provider, "snapshot/get", json!({}))
        .await?;
    subscribe(client, run).await.map(|_| ())
}

async fn capture_session_list_after_new(
    client: &mut CaptureClient,
    run: &mut CaptureRun,
) -> Result<()> {
    initialize(client, run).await?;
    session_new(client, run).await?;
    client
        .dispatch(run.provider, "session/list", json!({}))
        .await?;
    subscribe(client, run).await.map(|_| ())
}

async fn capture_session_load_known_session(
    client: &mut CaptureClient,
    run: &mut CaptureRun,
) -> Result<()> {
    initialize(client, run).await?;
    session_new(client, run).await?;
    let session_id = required_session_id(run)?;
    client
        .dispatch(
            run.provider,
            "session/load",
            json!({ "session_id": session_id, "cwd": run.cwd.display().to_string() }),
        )
        .await?;
    subscribe(client, run).await.map(|_| ())
}

async fn capture_session_cancel(client: &mut CaptureClient, run: &mut CaptureRun) -> Result<()> {
    initialize(client, run).await?;
    session_new(client, run).await?;
    let session_id = required_session_id(run)?;
    client
        .dispatch(
            run.provider,
            "session/cancel",
            json!({ "session_id": session_id }),
        )
        .await?;
    subscribe(client, run).await.map(|_| ())
}

async fn capture_reconnect_after_disconnect(
    client: &mut CaptureClient,
    run: &mut CaptureRun,
) -> Result<()> {
    initialize(client, run).await?;
    session_new(client, run).await?;
    client
        .dispatch(run.provider, "provider/disconnect", json!({}))
        .await?;
    initialize(client, run).await?;
    client
        .dispatch(run.provider, "session/list", json!({}))
        .await?;
    subscribe(client, run).await.map(|_| ())
}

async fn capture_provider_error_load_missing_session(
    client: &mut CaptureClient,
    run: &mut CaptureRun,
) -> Result<()> {
    initialize(client, run).await?;
    client
        .dispatch(
            run.provider,
            "session/load",
            json!({ "session_id": run.missing_session_id(), "cwd": run.cwd.display().to_string() }),
        )
        .await?;
    client
        .dispatch(run.provider, "snapshot/get", json!({}))
        .await?;
    subscribe(client, run).await.map(|_| ())
}

fn write_raw_capture(
    proof: &ProofWorkspace,
    provider: ProviderId,
    scenario: &str,
    client: &CaptureClient,
    args: &[String],
) -> Result<()> {
    let metadata = ReplayMetadata {
        schema: REPLAY_WORKFLOW_SCHEMA.to_owned(),
        provider,
        scenario: scenario.to_owned(),
        cwd: proof.cwd().display().to_string(),
        capture_id: capture_id(provider, scenario)?,
        raw_capture_safe_to_promote: false,
        curated_replay_safe_to_promote: false,
        command: command_text(args),
        blockers: Vec::new(),
    };
    let root = proof.artifact_root();
    write_json(root.join("metadata.json"), &metadata)?;
    write_jsonl(root.join("frames.jsonl"), &client.frames)?;
    write_jsonl(root.join("responses.jsonl"), &client.responses)?;
    write_jsonl(root.join("events.jsonl"), &client.events)?;
    write_text(
        root.join("summary.md"),
        &raw_summary(root, provider, scenario, client),
    )
}

fn raw_summary(
    root: &Path,
    provider: ProviderId,
    scenario: &str,
    client: &CaptureClient,
) -> String {
    format!(
        "# Replay Raw Capture\n\nProvider: `{}`\n\nScenario: `{}`\n\nRaw artifact root: `{}`\n\nFrames: `{}`\n\nResponses: `{}`\n\nEvents: `{}`\n\nPromotion status: `raw-not-promotable`.\n\nNext step: run `replay curate --raw-root {}` and review the candidate fixture before promotion.\n",
        provider.as_str(),
        scenario,
        root.display(),
        client.frames.len(),
        client.responses.len(),
        client.events.len(),
        root.display()
    )
}

fn session_id_from_response(response: &Value) -> Option<String> {
    response
        .get("response")
        .and_then(|value| value.get("result"))
        .and_then(|value| value.get("sessionId").or_else(|| value.get("session_id")))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn required_session_id(run: &CaptureRun) -> Result<&str> {
    run.session_id
        .as_deref()
        .ok_or_else(|| invalid_capture("session/new did not return a session id"))
}
