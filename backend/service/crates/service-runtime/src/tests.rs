//! Tests for the consumer runtime manager.

use super::{
    ConsumerCommand, ConsumerResponse, ProviderFactory, ProviderPort, Result, ServiceRuntime,
};
use acp_core::{ConnectionState, ProviderSnapshot, RawWireEvent, WireKind, WireStream};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use serde_json::{Value, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::rc::Rc;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Default)]
struct FakeState {
    connects: HashMap<ProviderId, usize>,
    disconnected: bool,
    sessions: usize,
}

#[derive(Clone)]
struct FakeFactory {
    state: Rc<RefCell<FakeState>>,
}

impl ProviderFactory for FakeFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        let mut state = self.state.borrow_mut();
        let connects = state.connects.entry(provider).or_default();
        *connects += 1;
        Ok(Box::new(FakeProvider {
            provider,
            state: Rc::clone(&self.state),
        }))
    }
}

struct FakeProvider {
    provider: ProviderId,
    state: Rc<RefCell<FakeState>>,
}

impl ProviderPort for FakeProvider {
    fn snapshot(&self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: if self.state.borrow().disconnected {
                ConnectionState::Disconnected
            } else {
                ConnectionState::Ready
            },
            discovery: fake_discovery(self.provider),
            capabilities: json!({}),
            auth_methods: Vec::new(),
            live_sessions: Vec::new(),
            last_prompt: None,
        }
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        vec![RawWireEvent {
            sequence: 1,
            stream: WireStream::Outgoing,
            kind: WireKind::Request,
            payload: "{}".to_owned(),
            method: Some("initialize".to_owned()),
            request_id: Some("1".to_owned()),
            json: Some(json!({})),
        }]
    }

    fn disconnect(&mut self) -> Result<()> {
        self.state.borrow_mut().disconnected = true;
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        let mut state = self.state.borrow_mut();
        state.sessions += 1;
        Ok(json!({ "sessionId": format!("session-{}", state.sessions) }))
    }

    fn session_list(&mut self) -> Result<Value> {
        Ok(json!({ "sessions": [] }))
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_prompt(&mut self, session_id: String, prompt: String) -> Result<Value> {
        Ok(json!({ "sessionId": session_id, "prompt": prompt }))
    }

    fn session_cancel(&mut self, session_id: String) -> Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }
}

#[test]
fn dispatch_reuses_provider_between_commands() -> TestResult<()> {
    let state = Rc::new(RefCell::new(FakeState::default()));
    let mut runtime = runtime(Rc::clone(&state));
    let first = runtime.dispatch(command("1", "initialize", "claude", json!({})));
    let second = runtime.dispatch(command(
        "2",
        "session/new",
        "claude",
        json!({ "cwd": "/repo" }),
    ));

    assert_ok(&first)?;
    assert_ok(&second)?;
    let connect_count = state.borrow().connects.get(&ProviderId::Claude).copied();
    if connect_count != Some(1) {
        return Err(format!("expected one claude connect, got {connect_count:?}").into());
    }
    Ok(())
}

#[test]
fn dispatch_rejects_unknown_provider() -> TestResult<()> {
    let state = Rc::new(RefCell::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command("1", "initialize", "bad", json!({})));

    if response.ok {
        return Err("unknown provider unexpectedly succeeded".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("unknown_provider".to_owned()) {
        return Err(format!("expected unknown_provider error, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn disconnect_and_snapshot_access_use_manager_state() -> TestResult<()> {
    let state = Rc::new(RefCell::new(FakeState::default()));
    let mut runtime = runtime(state);
    assert_ok(&runtime.dispatch(command("1", "initialize", "codex", json!({}))))?;

    let disconnected = runtime.dispatch(command("2", "provider/disconnect", "codex", json!({})));
    let snapshot = runtime.dispatch(command("3", "provider/snapshot", "codex", json!({})));

    assert_ok(&disconnected)?;
    assert_ok(&snapshot)?;
    let connection_state = snapshot.snapshot.map(|value| value.connection_state);
    if connection_state != Some(ConnectionState::Disconnected) {
        return Err(format!("expected disconnected snapshot, got {connection_state:?}").into());
    }
    Ok(())
}

#[test]
fn event_subscription_returns_raw_wire_truth() -> TestResult<()> {
    let state = Rc::new(RefCell::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command("1", "events/subscribe", "copilot", json!({})));

    assert_ok(&response)?;
    if !response.result.is_array() {
        return Err(format!("expected array event stream, got {}", response.result).into());
    }
    Ok(())
}

fn runtime(state: Rc<RefCell<FakeState>>) -> ServiceRuntime<FakeFactory> {
    ServiceRuntime::with_factory(FakeFactory { state })
}

fn command(id: &str, command: &str, provider: &str, params: Value) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: command.to_owned(),
        provider: provider.to_owned(),
        params,
    }
}

fn assert_ok(response: &ConsumerResponse) -> TestResult<()> {
    if !response.ok {
        return Err(format!("command failed: {:?}", response.error).into());
    }
    Ok(())
}

fn fake_discovery(provider: ProviderId) -> ProviderDiscovery {
    ProviderDiscovery {
        provider,
        launcher: LauncherCommand {
            executable: PathBuf::from(provider.as_str()),
            args: Vec::new(),
            display: provider.as_str().to_owned(),
        },
        resolved_path: provider.as_str().to_owned(),
        version: "fake".to_owned(),
        auth_hints: Vec::new(),
        initialize_viable: true,
        transport_diagnostics: Vec::new(),
        initialize_probe: InitializeProbe {
            response: json!({}),
            payload: InitializeResponse::new(ProtocolVersion::V1)
                .agent_info(Implementation::new("fake-agent", "0.5.0")),
            stdout_lines: Vec::new(),
            stderr_lines: Vec::new(),
            elapsed_ms: 1,
        },
    }
}
