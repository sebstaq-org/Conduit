//! Consumer API proof runner for Phase 1.5.

use crate::artifact::{write_json, write_jsonl, write_text};
use crate::error::{Result, ServiceError};
use crate::proof::ProofWorkspace;
use crate::serve;
use crate::support::command_text;
use acp_core::ProviderSnapshot;
use acp_discovery::ProviderId;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use service_runtime::{AppServiceFactory, ConsumerCommand, ConsumerResponse};
use session_store::LocalStore;
use std::path::Path;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio_tungstenite::MaybeTlsStream;
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

const READY_PROMPT: &str = "Reply with exactly CONDUIT_CONSUMER_API_READY.";
type ProofSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

struct ConsumerArtifact<'a> {
    root: &'a Path,
    command: &'a str,
    provider: ProviderId,
    session_id: &'a str,
    responses: &'a [ConsumerResponse],
    events: &'a [service_runtime::RuntimeEvent],
    snapshot: &'a ProviderSnapshot,
}

/// Runs a provider proof through the normal consumer API boundary.
///
/// # Errors
///
/// Returns an error when provider runtime commands fail or artifacts cannot be
/// written.
pub(crate) async fn run(provider: ProviderId, root: &Path, args: &[String]) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let factory = AppServiceFactory::with_environment(proof.environment().clone());
    let local_store = LocalStore::open_path(proof.artifact_root().join("local-store.sqlite3"))?;
    let server = serve::spawn_proof_server(factory, local_store).await?;
    let mut client = ProofClient::connect(server.address).await?;
    let mut responses = Vec::new();
    let mut events = Vec::new();
    let mut capture = ProofCapture {
        client: &mut client,
        responses: &mut responses,
        events: &mut events,
    };
    let session_id = seed_session(provider, &proof, &mut capture).await?;
    let snapshot = recover_session(provider, &proof, &session_id, &mut capture).await?;
    write_consumer_artifacts(ConsumerArtifact {
        root: proof.artifact_root(),
        command: &command_text(args),
        provider,
        session_id: &session_id,
        responses: &responses,
        events: &events,
        snapshot: &snapshot,
    })
}

async fn seed_session(
    provider: ProviderId,
    proof: &ProofWorkspace,
    capture: &mut ProofCapture<'_>,
) -> Result<String> {
    submit(capture, provider, "initialize", json!({})).await?;
    let created = submit(
        capture,
        provider,
        "session/new",
        json!({ "cwd": proof.cwd().display().to_string() }),
    )
    .await?;
    let session_id = session_id_from_result(&created.result)?;
    let opened = submit(
        capture,
        provider,
        "session/open",
        json!({
            "sessionId": session_id,
            "cwd": proof.cwd().display().to_string(),
        }),
    )
    .await?;
    let open_session_id = opened
        .result
        .get("openSessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid_capture("session/open did not return openSessionId"))?
        .to_owned();
    submit(
        capture,
        provider,
        "session/prompt",
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": READY_PROMPT }]
        }),
    )
    .await?;
    submit(capture, provider, "session/list", json!({})).await?;
    submit(capture, provider, "provider/disconnect", json!({})).await?;
    session_id_from_result(&created.result)
}

async fn recover_session(
    provider: ProviderId,
    proof: &ProofWorkspace,
    seeded_session_id: &str,
    capture: &mut ProofCapture<'_>,
) -> Result<ProviderSnapshot> {
    submit(capture, provider, "initialize", json!({})).await?;
    let list = submit(capture, provider, "session/list", json!({})).await?;
    let load_id = recoverable_session_id(
        &list.result,
        seeded_session_id,
        &proof.cwd().display().to_string(),
    )?;
    submit(
        capture,
        provider,
        "session/load",
        json!({ "session_id": load_id, "cwd": proof.cwd().display().to_string() }),
    )
    .await?;
    submit(
        capture,
        provider,
        "session/cancel",
        json!({ "session_id": load_id }),
    )
    .await?;
    submit(capture, provider, "snapshot/get", json!({})).await?;
    submit(capture, provider, "events/subscribe", json!({})).await?;
    let disconnected = submit(capture, provider, "provider/disconnect", json!({})).await?;
    disconnected
        .snapshot
        .ok_or_else(|| invalid_capture("provider/disconnect did not return a snapshot"))
}

async fn submit(
    capture: &mut ProofCapture<'_>,
    provider: ProviderId,
    command: &str,
    params: Value,
) -> Result<ConsumerResponse> {
    let response = capture
        .client
        .dispatch(
            ProofDispatch {
                provider,
                command,
                params,
                sequence: capture.responses.len() + 1,
            },
            capture.events,
        )
        .await?;
    if !response.ok {
        return Err(invalid_capture(&format!(
            "{command} failed: {:?}",
            response.error
        )));
    }
    capture.responses.push(response.clone());
    Ok(response)
}

struct ProofCapture<'a> {
    client: &'a mut ProofClient,
    responses: &'a mut Vec<ConsumerResponse>,
    events: &'a mut Vec<service_runtime::RuntimeEvent>,
}

struct ProofDispatch<'a> {
    provider: ProviderId,
    command: &'a str,
    params: Value,
    sequence: usize,
}

struct ProofClient {
    socket: ProofSocket,
}

impl ProofClient {
    async fn connect(address: std::net::SocketAddr) -> Result<Self> {
        let url = format!("ws://{address}/api/session");
        let (socket, _response) = connect_async(url)
            .await
            .map_err(|error| invalid_capture(&format!("websocket connect failed: {error}")))?;
        Ok(Self { socket })
    }

    async fn dispatch(
        &mut self,
        dispatch: ProofDispatch<'_>,
        events: &mut Vec<service_runtime::RuntimeEvent>,
    ) -> Result<ConsumerResponse> {
        let id = format!("consumer-{}", dispatch.sequence);
        self.send_command(&id, dispatch).await?;
        let response = self.read_response(&id, events).await?;
        self.read_expected_backlog(&response, events).await?;
        self.drain_events(events).await?;
        Ok(response)
    }

    async fn send_command(&mut self, id: &str, dispatch: ProofDispatch<'_>) -> Result<()> {
        let frame = json!({
            "v": 1,
            "type": "command",
            "id": id,
            "command": ConsumerCommand {
                id: id.to_owned(),
                command: dispatch.command.to_owned(),
                provider: dispatch.provider.as_str().to_owned(),
                params: dispatch.params,
            },
        });
        self.socket
            .send(Message::Text(frame.to_string().into()))
            .await
            .map_err(|error| invalid_capture(&format!("websocket send failed: {error}")))
    }

    async fn read_response(
        &mut self,
        id: &str,
        events: &mut Vec<service_runtime::RuntimeEvent>,
    ) -> Result<ConsumerResponse> {
        loop {
            let message = self.next_message().await?;
            if let Some(response) = response_from_message(&message, id)? {
                return Ok(response);
            }
            if let Some(event) = event_from_message(&message)? {
                events.push(event);
            }
        }
    }

    async fn read_expected_backlog(
        &mut self,
        response: &ConsumerResponse,
        events: &mut Vec<service_runtime::RuntimeEvent>,
    ) -> Result<()> {
        let Some(backlog) = response.result.get("events").and_then(Value::as_array) else {
            return Ok(());
        };
        for _entry in backlog {
            let message = self.next_message().await?;
            if let Some(event) = event_from_message(&message)? {
                events.push(event);
            }
        }
        Ok(())
    }

    async fn drain_events(
        &mut self,
        events: &mut Vec<service_runtime::RuntimeEvent>,
    ) -> Result<()> {
        while let Ok(message) =
            tokio::time::timeout(Duration::from_millis(50), self.next_message()).await
        {
            if let Some(event) = event_from_message(&message?)? {
                events.push(event);
            }
        }
        Ok(())
    }

    async fn next_message(&mut self) -> Result<Message> {
        let Some(message) = self.socket.next().await else {
            return Err(invalid_capture("websocket closed before response"));
        };
        message.map_err(|error| invalid_capture(&format!("websocket read failed: {error}")))
    }
}

fn response_from_message(message: &Message, id: &str) -> Result<Option<ConsumerResponse>> {
    let value = json_from_message(message)?;
    if value.get("type").and_then(Value::as_str) != Some("response") {
        return Ok(None);
    }
    if value.get("id").and_then(Value::as_str) != Some(id) {
        return Err(invalid_capture(
            "websocket response id did not match command id",
        ));
    }
    let response = value
        .get("response")
        .cloned()
        .ok_or_else(|| invalid_capture("websocket response frame was missing response"))?;
    serde_json::from_value(response)
        .map_err(ServiceError::from)
        .map(Some)
}

fn event_from_message(message: &Message) -> Result<Option<service_runtime::RuntimeEvent>> {
    let value = json_from_message(message)?;
    if value.get("type").and_then(Value::as_str) != Some("event") {
        return Ok(None);
    }
    let event = value
        .get("event")
        .cloned()
        .ok_or_else(|| invalid_capture("websocket event frame was missing event"))?;
    serde_json::from_value(event)
        .map_err(ServiceError::from)
        .map(Some)
}

fn json_from_message(message: &Message) -> Result<Value> {
    let Message::Text(text) = message else {
        return Err(invalid_capture("websocket message was not text"));
    };
    serde_json::from_str(text).map_err(ServiceError::from)
}

fn session_id_from_result(value: &Value) -> Result<String> {
    value
        .get("sessionId")
        .or_else(|| value.get("session_id"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_capture("consumer response did not include session id"))
}

fn recoverable_session_id(value: &Value, seeded_session_id: &str, cwd: &str) -> Result<String> {
    let Some(sessions) = value.get("sessions").and_then(Value::as_array) else {
        return Err(invalid_capture(
            "session/list response did not include sessions",
        ));
    };
    if let Some(session_id) = sessions.iter().find_map(|session| {
        let session_cwd = session.get("cwd").and_then(Value::as_str);
        let session_id = session_id_from_session(session);
        if session_cwd == Some(cwd) {
            return session_id;
        }
        None
    }) {
        return Ok(session_id);
    }
    if sessions
        .iter()
        .any(|session| session_id_from_session(session).as_deref() == Some(seeded_session_id))
    {
        return Ok(seeded_session_id.to_owned());
    }
    Err(invalid_capture(
        "session/list did not expose the seeded session",
    ))
}

fn session_id_from_session(value: &Value) -> Option<String> {
    value
        .get("sessionId")
        .or_else(|| value.get("session_id"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn write_consumer_artifacts(artifact: ConsumerArtifact<'_>) -> Result<()> {
    write_text(artifact.root.join("command.txt"), artifact.command)?;
    write_jsonl(artifact.root.join("stdout.log"), artifact.responses)?;
    write_text(
        artifact.root.join("stderr.log"),
        &stderr_log(artifact.events),
    )?;
    write_jsonl(artifact.root.join("events.jsonl"), artifact.events)?;
    write_json(artifact.root.join("snapshot.json"), artifact.snapshot)?;
    write_text(
        artifact.root.join("summary.md"),
        &summary(
            artifact.provider,
            artifact.session_id,
            artifact.responses.len(),
            artifact.events.len(),
        ),
    )
}

fn stderr_log(events: &[service_runtime::RuntimeEvent]) -> String {
    events
        .iter()
        .filter(|event| event.kind == service_runtime::RuntimeEventKind::RawWireEventCaptured)
        .filter_map(|event| {
            let payload = &event.payload;
            if payload.get("stream").and_then(Value::as_str) == Some("stderr") {
                return payload
                    .get("payload")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned);
            }
            None
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn summary(
    provider: ProviderId,
    session_id: &str,
    response_count: usize,
    event_count: usize,
) -> String {
    format!(
        "# Phase 1.5 Consumer API Proof: {provider}\n\nConsumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> snapshot/get -> events/subscribe -> provider/disconnect`.\n\nSeeded ACP session id: `{session_id}`.\n\nConsumer responses captured: `{response_count}`.\n\nRuntime events captured: `{event_count}`.\n\nProvider caveats:\n\n{}\n\n`session/cancel` is recorded as a provider notification request and no provider-independent final cancel state is asserted.\n",
        provider_caveat(provider)
    )
}

fn provider_caveat(provider: ProviderId) -> &'static str {
    match provider {
        ProviderId::Claude => {
            "Claude replay during `session/load` is preserved in raw runtime events and is not filtered."
        }
        ProviderId::Copilot => {
            "Copilot `session/load` is exercised after `provider/disconnect` with a fresh `ServiceRuntime` connection."
        }
        ProviderId::Codex => {
            "Codex `session/load` is exercised only after the seeded session has a materialized prompt turn."
        }
    }
}

fn invalid_capture(message: &str) -> ServiceError {
    ServiceError::InvalidCapture {
        message: message.to_owned(),
    }
}
