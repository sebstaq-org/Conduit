//! Process and line transport for ACP stdio ownership.

use crate::error::{AcpError, Result};
use acp_discovery::{LauncherCommand, ProcessEnvironment, ProviderId};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::sync::{Arc, Mutex};
use std::thread;

/// One inbound line from a provider process.
#[derive(Debug)]
pub(crate) enum InboundLine {
    /// A JSON-RPC line from stdout.
    Stdout(String),
    /// A diagnostic line from stderr.
    Stderr(String),
    /// One transport stream closed.
    Closed(&'static str),
}

/// ACP stdio transport for one live provider process.
pub(crate) struct Transport {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    inbound: Receiver<InboundLine>,
    connected: Arc<AtomicBool>,
}

impl Transport {
    /// Spawns one provider transport with piped stdio.
    pub(crate) fn spawn(
        provider: ProviderId,
        launcher: &LauncherCommand,
        environment: &ProcessEnvironment,
    ) -> Result<Self> {
        let mut command = Command::new(&launcher.executable);
        command
            .args(&launcher.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        environment.apply_to_command(&mut command);
        let mut child = command
            .spawn()
            .map_err(|source| AcpError::Spawn { provider, source })?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| stream_closed(provider, "stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| stream_closed(provider, "stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| stream_closed(provider, "stderr"))?;
        let (sender, inbound) = channel();
        let connected = Arc::new(AtomicBool::new(true));
        spawn_reader(stdout, sender.clone(), true, Arc::clone(&connected));
        spawn_reader(stderr, sender, false, Arc::clone(&connected));

        Ok(Self {
            child,
            stdin: Arc::new(Mutex::new(stdin)),
            inbound,
            connected,
        })
    }

    /// Sends one newline-delimited JSON-RPC message.
    pub(crate) fn send_line(
        &self,
        provider: ProviderId,
        operation: &str,
        line: &str,
    ) -> Result<()> {
        let mut guard = self
            .stdin
            .lock()
            .map_err(|source| AcpError::UnexpectedEnvelope {
                provider,
                message: format!("stdin mutex poisoned while sending {operation}: {source}"),
            })?;
        guard
            .write_all(format!("{line}\n").as_bytes())
            .and_then(|_| guard.flush())
            .map_err(|source| AcpError::StdinWrite {
                provider,
                operation: operation.to_owned(),
                source,
            })
    }

    /// Returns the inbound channel for stdout and stderr lines.
    pub(crate) fn inbound(&self) -> &Receiver<InboundLine> {
        &self.inbound
    }

    /// Returns whether the underlying provider process is still connected.
    #[must_use]
    pub(crate) fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    /// Shuts down the provider process.
    pub(crate) fn shutdown(&mut self) {
        self.connected.store(false, Ordering::Relaxed);
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn spawn_reader(
    reader: impl std::io::Read + Send + 'static,
    sender: Sender<InboundLine>,
    stdout: bool,
    connected: Arc<AtomicBool>,
) {
    let _ = thread::Builder::new()
        .name("acp-core-reader".to_owned())
        .spawn(move || {
            let stream = if stdout { "stdout" } else { "stderr" };
            for line in BufReader::new(reader).lines() {
                match line {
                    Ok(line) => {
                        let event = if stdout {
                            InboundLine::Stdout(line)
                        } else {
                            InboundLine::Stderr(line)
                        };
                        if sender.send(event).is_err() {
                            return;
                        }
                    }
                    Err(_) => break,
                }
            }
            connected.store(false, Ordering::Relaxed);
            let _ = sender.send(InboundLine::Closed(stream));
        });
}

fn stream_closed(provider: ProviderId, stream: &str) -> AcpError {
    AcpError::StreamClosed {
        provider,
        stream: stream.to_owned(),
        operation: "spawn".to_owned(),
    }
}
