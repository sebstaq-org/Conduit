//! Test support for `service-runtime` integration tests.

use acp_core::{
    ConnectionState, InteractionResponse, LiveSessionIdentity, LoadedTranscriptSnapshot,
    PromptLifecycleSnapshot, PromptLifecycleState, ProviderSnapshot, RawWireEvent,
    TranscriptUpdateSnapshot, WireKind, WireStream,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use serde_json::{Value, json};
use service_runtime::{
    ConsumerCommand, ConsumerResponse, ProviderFactory, ProviderPort, Result, RuntimeError,
    ServiceRuntime,
};
use session_store::LocalStore;
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
pub(crate) type SessionListKey = (ProviderId, Option<String>, Option<String>);

static NEXT_TEST_DB: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub(crate) struct FakeState {
    pub(crate) connects: HashMap<ProviderId, usize>,
    pub(crate) session_lists: HashMap<ProviderId, Value>,
    pub(crate) session_list_pages: HashMap<SessionListKey, Value>,
    pub(crate) session_list_errors: HashMap<ProviderId, String>,
    pub(crate) session_load_updates: HashMap<(ProviderId, String), Vec<TranscriptUpdateSnapshot>>,
    pub(crate) session_load_requests: Vec<(ProviderId, String)>,
    pub(crate) session_list_requests: Vec<SessionListKey>,
    pub(crate) prompt_agent_text: HashMap<(ProviderId, String), Vec<String>>,
    pub(crate) prompt_updates: HashMap<(ProviderId, String), Vec<TranscriptUpdateSnapshot>>,
    pub(crate) prompt_errors: HashMap<(ProviderId, String), String>,
    pub(crate) prompt_lifecycle_missing: HashSet<(ProviderId, String)>,
    pub(crate) prompt_stop_reason: HashMap<(ProviderId, String), String>,
    pub(crate) interaction_responses: Vec<(ProviderId, String, String, Value)>,
    pub(crate) interaction_response_errors: HashMap<(ProviderId, String, String), String>,
    loaded_transcripts: HashMap<(ProviderId, String), LoadedTranscriptSnapshot>,
    last_prompt: Option<PromptLifecycleSnapshot>,
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
            last_prompt: self
                .state
                .lock()
                .map(|state| state.last_prompt.clone())
                .unwrap_or_default(),
            loaded_transcripts: self
                .state
                .lock()
                .map(|state| {
                    state
                        .loaded_transcripts
                        .values()
                        .filter(|transcript| transcript.identity.provider == self.provider)
                        .cloned()
                        .collect()
                })
                .unwrap_or_default(),
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
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        state
            .session_load_requests
            .push((self.provider, session_id.clone()));
        let updates = state
            .session_load_updates
            .get(&(self.provider, session_id.clone()))
            .cloned()
            .unwrap_or_default();
        state.loaded_transcripts.insert(
            (self.provider, session_id.clone()),
            LoadedTranscriptSnapshot {
                identity: LiveSessionIdentity {
                    provider: self.provider,
                    acp_session_id: session_id.clone(),
                },
                raw_update_count: updates.len(),
                updates,
            },
        );
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        prompt: Vec<Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<Value> {
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        if let Some(error) = state
            .prompt_errors
            .get(&(self.provider, session_id.clone()))
        {
            return Err(RuntimeError::Provider(error.clone()));
        }
        let stop_reason = state
            .prompt_stop_reason
            .get(&(self.provider, session_id.clone()))
            .cloned()
            .unwrap_or_else(|| "end_turn".to_owned());
        let prompt = prompt_text(&prompt);
        let (agent_text_chunks, updates) =
            fake_prompt_updates(&state, self.provider, &session_id, &prompt);
        if !state
            .prompt_lifecycle_missing
            .contains(&(self.provider, session_id.clone()))
        {
            for update in &updates {
                update_sink(update.clone());
            }
            state.last_prompt = Some(PromptLifecycleSnapshot {
                identity: LiveSessionIdentity {
                    provider: self.provider,
                    acp_session_id: session_id.clone(),
                },
                state: fake_prompt_lifecycle_state(&stop_reason),
                stop_reason: Some(stop_reason.clone()),
                raw_update_count: updates.len(),
                agent_text_chunks,
                updates,
            });
        }
        Ok(json!({
            "sessionId": session_id,
            "prompt": prompt,
            "stopReason": stop_reason
        }))
    }

    fn session_cancel(&mut self, session_id: String) -> Result<Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        _config_id: String,
        _value: String,
    ) -> Result<Value> {
        Ok(json!({
            "sessionId": session_id,
            "configOptions": []
        }))
    }

    fn session_respond_interaction(
        &mut self,
        session_id: String,
        interaction_id: String,
        response: InteractionResponse,
    ) -> Result<Value> {
        let mut state = self
            .state
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        if let Some(error) = state.interaction_response_errors.get(&(
            self.provider,
            session_id.clone(),
            interaction_id.clone(),
        )) {
            return Err(RuntimeError::Provider(error.clone()));
        }
        let response_payload = interaction_response_payload(response);
        state.interaction_responses.push((
            self.provider,
            session_id.clone(),
            interaction_id.clone(),
            response_payload.clone(),
        ));
        Ok(json!({
            "sessionId": session_id,
            "interactionId": interaction_id,
            "response": response_payload
        }))
    }
}

fn prompt_text(prompt: &[Value]) -> String {
    prompt
        .iter()
        .filter_map(|block| {
            if block.get("type").and_then(Value::as_str) == Some("text") {
                return block.get("text").and_then(Value::as_str);
            }
            None
        })
        .collect::<Vec<_>>()
        .join("")
}

fn fake_prompt_updates(
    state: &FakeState,
    provider: ProviderId,
    session_id: &str,
    prompt: &str,
) -> (Vec<String>, Vec<TranscriptUpdateSnapshot>) {
    let key = (provider, session_id.to_owned());
    let agent_text_chunks = state
        .prompt_agent_text
        .get(&key)
        .cloned()
        .unwrap_or_else(|| vec![prompt.to_owned()]);
    let updates = state
        .prompt_updates
        .get(&key)
        .cloned()
        .unwrap_or_else(|| prompt_updates_from_chunks(&agent_text_chunks));
    (agent_text_chunks, updates)
}

fn prompt_updates_from_chunks(chunks: &[String]) -> Vec<TranscriptUpdateSnapshot> {
    chunks
        .iter()
        .enumerate()
        .map(|(index, text)| TranscriptUpdateSnapshot {
            index,
            variant: "agent_message_chunk".to_owned(),
            update: json!({
                "sessionUpdate": "agent_message_chunk",
                "content": {
                    "type": "text",
                    "text": text
                }
            }),
        })
        .collect()
}

fn fake_prompt_lifecycle_state(stop_reason: &str) -> PromptLifecycleState {
    if stop_reason == "cancelled" {
        PromptLifecycleState::Cancelled
    } else {
        PromptLifecycleState::Completed
    }
}

fn interaction_response_payload(response: InteractionResponse) -> Value {
    match response {
        InteractionResponse::Selected { option_id } => {
            json!({
                "kind": "selected",
                "optionId": option_id
            })
        }
        InteractionResponse::AnswerOther {
            option_id,
            question_id,
            text,
        } => json!({
            "kind": "answer_other",
            "optionId": option_id,
            "questionId": question_id,
            "text": text
        }),
        InteractionResponse::Cancelled => {
            json!({
                "kind": "cancel"
            })
        }
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

pub(crate) fn runtime(state: Arc<Mutex<FakeState>>) -> TestResult<ServiceRuntime<FakeFactory>> {
    Ok(ServiceRuntime::with_factory(
        FakeFactory::new(state),
        LocalStore::open_path(test_db_path()?)?,
    ))
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

fn test_db_path() -> TestResult<PathBuf> {
    let sequence = NEXT_TEST_DB.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!(
        "conduit-service-runtime-{}-{sequence}-{nanos}.sqlite3",
        std::process::id()
    )))
}
