//! Integration tests for tracing command lifecycle events.

mod support;

use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use serde as _;
use serde_json::{Value, json};
use std::io;
use std::io::Write;
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, command, runtime};
use thiserror as _;
use tracing_subscriber::EnvFilter;

#[derive(Clone, Default)]
struct SharedLogBuffer {
    bytes: Arc<Mutex<Vec<u8>>>,
}

impl SharedLogBuffer {
    fn lines(&self) -> TestResult<Vec<Value>> {
        let bytes = self
            .bytes
            .lock()
            .map_err(|error| format!("shared log buffer lock poisoned: {error}"))?
            .clone();
        let text = String::from_utf8(bytes).map_err(|error| error.to_string())?;
        let lines = text
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str::<Value>(line).map_err(|error| error.to_string()))
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|error| format!("failed to parse tracing JSON line: {error}"))?;
        Ok(lines)
    }
}

struct SharedLogWriter {
    buffer: Arc<Mutex<Vec<u8>>>,
}

impl Write for SharedLogWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let mut bytes = self
            .buffer
            .lock()
            .map_err(|_| io::Error::other("shared log buffer lock poisoned"))?;
        bytes.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl<'writer> tracing_subscriber::fmt::MakeWriter<'writer> for SharedLogBuffer {
    type Writer = SharedLogWriter;

    fn make_writer(&'writer self) -> Self::Writer {
        SharedLogWriter {
            buffer: Arc::clone(&self.bytes),
        }
    }
}

#[test]
fn dispatch_logs_command_start_and_finish_for_success_response() -> TestResult<()> {
    let shared_logs = SharedLogBuffer::default();
    let subscriber = tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::new("debug"))
        .with_writer(shared_logs.clone())
        .without_time()
        .finish();
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;

    tracing::subscriber::with_default(subscriber, || {
        let response = runtime.dispatch(command("telemetry-1", "settings/get", "all", json!({})));
        if !response.ok {
            return Err(format!("settings/get failed unexpectedly: {response:?}"));
        }
        Ok::<(), String>(())
    })
    .map_err(|error| error.to_string())?;

    let events = shared_logs.lines()?;
    assert_has_event(&events, "command.start", "telemetry-1", None)?;
    assert_has_event(
        &events,
        "command.finish",
        "telemetry-1",
        Some(("ok", Value::Bool(true))),
    )
}

#[test]
fn dispatch_logs_error_code_for_failure_response() -> TestResult<()> {
    let shared_logs = SharedLogBuffer::default();
    let subscriber = tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::new("debug"))
        .with_writer(shared_logs.clone())
        .without_time()
        .finish();
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;

    tracing::subscriber::with_default(subscriber, || {
        let response = runtime.dispatch(command(
            "telemetry-2",
            "session/open",
            "codex",
            json!({ "cwd": "/repo" }),
        ));
        if response.ok {
            return Err(format!("session/open unexpectedly succeeded: {response:?}"));
        }
        Ok::<(), String>(())
    })
    .map_err(|error| error.to_string())?;

    let events = shared_logs.lines()?;
    assert_has_event(
        &events,
        "command.finish",
        "telemetry-2",
        Some(("error_code", Value::String("invalid_params".to_owned()))),
    )
}

fn assert_has_event(
    events: &[Value],
    event_name: &str,
    command_id: &str,
    expected_field: Option<(&str, Value)>,
) -> TestResult<()> {
    let found = events.iter().any(|entry| {
        let Some(fields) = entry.get("fields").and_then(Value::as_object) else {
            return false;
        };
        if fields.get("event_name") != Some(&Value::String(event_name.to_owned())) {
            return false;
        }
        if fields.get("command_id") != Some(&Value::String(command_id.to_owned())) {
            return false;
        }
        if let Some((key, expected)) = &expected_field {
            return fields.get(*key) == Some(expected);
        }
        true
    });
    if found {
        return Ok(());
    }
    Err(format!(
        "missing tracing event_name={event_name} command_id={command_id} expected_field={expected_field:?} in events: {events:?}"
    )
    .into())
}
