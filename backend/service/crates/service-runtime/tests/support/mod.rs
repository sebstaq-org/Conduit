//! Test support for `service-runtime` integration tests.

use acp_core::{ConnectionState, ProviderSnapshot, RawWireEvent, WireKind, WireStream};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use serde_json::{Value, json};
use service_runtime::{
    ConsumerCommand, ConsumerResponse, ProviderFactory, ProviderPort, Result, RuntimeError,
    RuntimeEvent, RuntimeEventKind, ServiceRuntime,
};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub(crate) type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
pub(crate) type SessionListKey = (ProviderId, Option<String>, Option<String>);

#[derive(Default)]
pub(crate) struct FakeState {
    pub(crate) connects: HashMap<ProviderId, usize>,
    pub(crate) session_lists: HashMap<ProviderId, Value>,
    pub(crate) session_list_pages: HashMap<SessionListKey, Value>,
    pub(crate) session_list_errors: HashMap<ProviderId, String>,
    pub(crate) session_list_requests: Vec<SessionListKey>,
    disconnected: bool,
    sessions: usize,
}

#[derive(Clone)]
pub(crate) struct FakeFactory {
    state: Arc<Mutex<FakeState>>,
}

impl FakeFactory {
    pub(crate) fn new(state: Arc<Mutex<FakeState>>) -> Self {
        Self { state }
    }
}

impl ProviderFactory for FakeFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        let connects = state.connects.entry(provider).or_default();
        *connects += 1;
        state.disconnected = false;
        Ok(Box::new(FakeProvider {
            provider,
            state: Arc::clone(&self.state),
        }))
    }
}

struct FakeProvider {
    provider: ProviderId,
    state: Arc<Mutex<FakeState>>,
}

impl ProviderPort for FakeProvider {
    fn snapshot(&self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: self.connection_state(),
            discovery: fake_discovery(self.provider),
            capabilities: json!({}),
            auth_methods: Vec::new(),
            live_sessions: Vec::new(),
            last_prompt: None,
            loaded_transcripts: Vec::new(),
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
        self.state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?
            .disconnected = true;
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        state.sessions += 1;
        Ok(json!({ "sessionId": format!("session-{}", state.sessions) }))
    }

    fn session_list(&mut self, cwd: Option<PathBuf>, cursor: Option<String>) -> Result<Value> {
        let cwd = cwd.map(|value| value.display().to_string());
        let key = (self.provider, cwd, cursor);
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        state.session_list_requests.push(key.clone());
        if let Some(error) = state.session_list_errors.get(&self.provider) {
            return Err(RuntimeError::Provider(error.to_owned()));
        }
        if let Some(page) = state.session_list_pages.get(&key) {
            return Ok(page.clone());
        }
        Ok(state
            .session_lists
            .get(&self.provider)
            .cloned()
            .unwrap_or_else(|| json!({ "sessions": [] })))
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

impl FakeProvider {
    fn connection_state(&self) -> ConnectionState {
        match self.state.lock() {
            Ok(state) if state.disconnected => ConnectionState::Disconnected,
            Ok(_) | Err(_) => ConnectionState::Ready,
        }
    }
}

pub(crate) fn runtime(state: Arc<Mutex<FakeState>>) -> ServiceRuntime<FakeFactory> {
    ServiceRuntime::with_factory(FakeFactory::new(state))
}

pub(crate) fn command(id: &str, command: &str, provider: &str, params: Value) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: command.to_owned(),
        provider: provider.to_owned(),
        params,
    }
}

pub(crate) fn assert_ok(response: &ConsumerResponse) -> TestResult<()> {
    if !response.ok {
        return Err(format!("command failed: {:?}", response.error).into());
    }
    Ok(())
}

pub(crate) fn ensure_event(events: &[RuntimeEvent], kind: RuntimeEventKind) -> TestResult<()> {
    if events.iter().any(|event| event.kind == kind) {
        return Ok(());
    }
    Err(format!("missing runtime event {kind:?}").into())
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
