//! Consumer API proof runner for Phase 1.5.

use crate::artifact::{write_json, write_jsonl, write_text};
use crate::error::{Result, ServiceError};
use crate::proof::ProofWorkspace;
use crate::support::command_text;
use acp_core::ProviderSnapshot;
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::{AppServiceFactory, ConsumerCommand, ConsumerResponse, ServiceRuntime};
use std::path::Path;

const READY_PROMPT: &str = "Reply with exactly CONDUIT_CONSUMER_API_READY.";

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
pub(crate) fn run(provider: ProviderId, root: &Path, args: &[String]) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let mut responses = Vec::new();
    let mut events = Vec::new();
    let session_id = seed_session(provider, &proof, &mut responses, &mut events)?;
    let snapshot = recover_session(provider, &proof, &session_id, &mut responses, &mut events)?;
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

fn seed_session(
    provider: ProviderId,
    proof: &ProofWorkspace,
    responses: &mut Vec<ConsumerResponse>,
    events: &mut Vec<service_runtime::RuntimeEvent>,
) -> Result<String> {
    let mut runtime = runtime(proof);
    submit(&mut runtime, provider, "initialize", json!({}), responses)?;
    let created = submit(
        &mut runtime,
        provider,
        "session/new",
        json!({ "cwd": proof.cwd().display().to_string() }),
        responses,
    )?;
    let session_id = session_id_from_result(&created.result)?;
    submit(
        &mut runtime,
        provider,
        "session/prompt",
        json!({ "session_id": session_id, "prompt": READY_PROMPT }),
        responses,
    )?;
    submit(&mut runtime, provider, "session/list", json!({}), responses)?;
    submit(
        &mut runtime,
        provider,
        "provider/disconnect",
        json!({}),
        responses,
    )?;
    events.extend(runtime.drain_events());
    session_id_from_result(&created.result)
}

fn recover_session(
    provider: ProviderId,
    proof: &ProofWorkspace,
    seeded_session_id: &str,
    responses: &mut Vec<ConsumerResponse>,
    events: &mut Vec<service_runtime::RuntimeEvent>,
) -> Result<ProviderSnapshot> {
    let mut runtime = runtime(proof);
    submit(&mut runtime, provider, "initialize", json!({}), responses)?;
    let list = submit(&mut runtime, provider, "session/list", json!({}), responses)?;
    let load_id = recoverable_session_id(
        &list.result,
        seeded_session_id,
        &proof.cwd().display().to_string(),
    )?;
    submit(
        &mut runtime,
        provider,
        "session/load",
        json!({ "session_id": load_id, "cwd": proof.cwd().display().to_string() }),
        responses,
    )?;
    submit(
        &mut runtime,
        provider,
        "session/cancel",
        json!({ "session_id": load_id }),
        responses,
    )?;
    submit(
        &mut runtime,
        provider,
        "provider/snapshot",
        json!({}),
        responses,
    )?;
    submit(
        &mut runtime,
        provider,
        "events/subscribe",
        json!({}),
        responses,
    )?;
    let disconnected = submit(
        &mut runtime,
        provider,
        "provider/disconnect",
        json!({}),
        responses,
    )?;
    events.extend(runtime.drain_events());
    disconnected
        .snapshot
        .ok_or_else(|| invalid_capture("provider/disconnect did not return a snapshot"))
}

fn runtime(proof: &ProofWorkspace) -> ServiceRuntime<AppServiceFactory> {
    ServiceRuntime::with_factory(AppServiceFactory::with_environment(
        proof.environment().clone(),
    ))
}

fn submit(
    runtime: &mut ServiceRuntime<AppServiceFactory>,
    provider: ProviderId,
    command: &str,
    params: Value,
    responses: &mut Vec<ConsumerResponse>,
) -> Result<ConsumerResponse> {
    let response = runtime.dispatch(ConsumerCommand {
        id: format!("consumer-{}", responses.len() + 1),
        command: command.to_owned(),
        provider: provider.as_str().to_owned(),
        params,
    });
    if !response.ok {
        return Err(invalid_capture(&format!(
            "{command} failed: {:?}",
            response.error
        )));
    }
    responses.push(response.clone());
    Ok(response)
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
        "# Phase 1.5 Consumer API Proof: {provider}\n\nConsumer API sequence: `initialize -> session/new -> session/prompt -> session/list -> provider/disconnect -> initialize -> session/list -> session/load -> session/cancel -> provider/snapshot -> events/subscribe -> provider/disconnect`.\n\nSeeded ACP session id: `{session_id}`.\n\nConsumer responses captured: `{response_count}`.\n\nRuntime events captured: `{event_count}`.\n\nProvider caveats:\n\n{}\n\n`session/cancel` is recorded as a raw ACP notification and no provider-independent final cancel state is asserted.\n",
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
