//! Child-process helpers for ACP discovery probes.

use crate::environment::ProcessEnvironment;
use crate::error::{DiscoveryError, Result};
use crate::probe::contract;
use crate::provider::{LauncherCommand, ProviderId};
use agent_client_protocol_schema::{ClientRequest, JsonRpcMessage, Request};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::thread;
use std::time::{Duration, Instant};

const INITIALIZE_TIMEOUT: Duration = Duration::from_secs(10);

pub(super) struct StdoutCapture {
    pub(super) response: Value,
    pub(super) stdout_lines: Vec<String>,
    pub(super) elapsed_ms: u64,
}

pub(super) struct ProviderProcess {
    pub(super) child: Child,
    pub(super) stdout_rx: Receiver<String>,
    pub(super) stderr_rx: Receiver<String>,
    pub(super) stdin: ChildStdin,
}

pub(super) fn spawn_provider_process(
    provider: ProviderId,
    launcher: &LauncherCommand,
    environment: &ProcessEnvironment,
) -> Result<ProviderProcess> {
    let mut command = Command::new(&launcher.executable);
    command
        .args(&launcher.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    environment.apply_to_command(&mut command);
    let mut child = command.spawn().map_err(|source| DiscoveryError::Spawn {
        program: launcher.display.clone(),
        source,
    })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| stream_closed(provider.as_str()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| stream_closed(provider.as_str()))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| stream_closed(provider.as_str()))?;
    let (stdout_tx, stdout_rx) = channel();
    let (stderr_tx, stderr_rx) = channel();
    spawn_reader(stdout, stdout_tx);
    spawn_reader(stderr, stderr_tx);

    Ok(ProviderProcess {
        child,
        stdout_rx,
        stderr_rx,
        stdin,
    })
}

pub(super) fn send_initialize_request(
    provider: ProviderId,
    launcher: &LauncherCommand,
    stdin: &mut ChildStdin,
    request: &JsonRpcMessage<Request<ClientRequest>>,
) -> Result<()> {
    let request_line =
        serde_json::to_string(request).map_err(|error| contract(provider, error.to_string()))?;
    stdin
        .write_all(format!("{request_line}\n").as_bytes())
        .and_then(|_| stdin.flush())
        .map_err(|source| DiscoveryError::StdinWrite {
            program: launcher.display.clone(),
            source,
        })
}

pub(super) fn read_initialize_response(
    provider: ProviderId,
    stdout_rx: &Receiver<String>,
) -> Result<StdoutCapture> {
    let started_at = Instant::now();
    let line = stdout_rx
        .recv_timeout(INITIALIZE_TIMEOUT)
        .map_err(|source| DiscoveryError::InitializeTimeout {
            provider: provider.as_str().to_owned(),
            timeout_ms: INITIALIZE_TIMEOUT.as_millis() as u64,
            source,
        })?;
    let response = serde_json::from_str::<Value>(&line).map_err(|source| DiscoveryError::Json {
        provider: provider.as_str().to_owned(),
        line: line.clone(),
        source,
    })?;
    let mut stdout_lines = vec![line];
    stdout_lines.extend(stdout_rx.try_iter());
    Ok(StdoutCapture {
        response,
        stdout_lines,
        elapsed_ms: started_at.elapsed().as_millis() as u64,
    })
}

pub(super) fn build_diagnostics(
    provider: ProviderId,
    elapsed_ms: u64,
    stderr_lines: &[String],
) -> Vec<String> {
    let mut diagnostics = vec![format!(
        "{} initialize responded in {} ms",
        provider.as_str(),
        elapsed_ms
    )];
    if stderr_lines.is_empty() {
        diagnostics.push("stderr lines captured: 0".to_owned());
    } else {
        diagnostics.push(format!("stderr lines captured: {}", stderr_lines.len()));
    }
    diagnostics
}

fn spawn_reader(reader: impl std::io::Read + Send + 'static, sender: Sender<String>) {
    let _ = thread::Builder::new()
        .name("acp-discovery-reader".to_owned())
        .spawn(move || {
            for line in BufReader::new(reader).lines() {
                match line {
                    Ok(line) => {
                        if sender.send(line).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
}

fn stream_closed(provider: &str) -> DiscoveryError {
    DiscoveryError::StreamClosed {
        provider: provider.to_owned(),
    }
}
