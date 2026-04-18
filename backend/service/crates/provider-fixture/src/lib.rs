//! Fixture-backed provider runtime for deterministic Conduit tests.

#![forbid(unsafe_code)]
#![deny(
    missing_docs,
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::invalid_codeblock_attributes,
    rustdoc::invalid_rust_codeblocks,
    rustdoc::missing_crate_level_docs,
    rustdoc::private_intra_doc_links
)]

use acp_core::{
    ConnectionState, InteractionResponse, LoadedTranscriptSnapshot, PromptLifecycleSnapshot,
    ProviderInitializeRequest, ProviderInitializeResult, ProviderSnapshot, RawWireEvent,
    TranscriptUpdateSnapshot,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use initialize::read_initialize_fixtures;
use load::{SessionLoadFixture, read_session_load_fixtures};
use new::read_session_new_fixtures;
use prompt::{SessionPromptFixture, read_session_prompt_fixtures};
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, ProviderPort, Result, RuntimeError};
use set_config::{SessionSetConfigOptionFixture, read_session_set_config_option_fixtures};
use std::collections::HashMap;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};

mod initialize;
mod load;
mod new;
mod prompt;
mod set_config;

const PROVIDERS: [ProviderId; 3] = [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex];

/// Fixture-backed provider factory keyed by provider id.
#[derive(Debug, Clone)]
pub struct FixtureProviderFactory {
    initializes: HashMap<ProviderId, ProviderInitializeResult>,
    session_lists: HashMap<ProviderId, Value>,
    session_news: HashMap<ProviderId, Value>,
    session_loads: HashMap<(ProviderId, String), SessionLoadFixture>,
    session_prompts: HashMap<(ProviderId, String), SessionPromptFixture>,
    session_set_config_options:
        HashMap<(ProviderId, String, String, String), SessionSetConfigOptionFixture>,
}

impl FixtureProviderFactory {
    /// Loads fixture-backed provider data from a fixture root.
    ///
    /// # Errors
    ///
    /// Returns an error when an existing fixture file cannot be read, cannot be
    /// parsed as JSON, or does not match the endpoint fixture contract.
    pub fn load(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        if !root.is_dir() {
            return Err(RuntimeError::Provider(format!(
                "fixture root {} must be an existing directory",
                root.display()
            )));
        }
        let mut initializes = HashMap::new();
        let mut session_lists = HashMap::new();
        let mut session_news = HashMap::new();
        let mut session_loads = HashMap::new();
        let mut session_prompts = HashMap::new();
        let mut session_set_config_options = HashMap::new();
        for provider in PROVIDERS {
            read_initialize_fixtures(root, provider, &mut initializes)?;
            let path = session_list_path(root, provider);
            if path.exists() {
                let value = read_session_list_fixture(&path)?;
                session_lists.insert(provider, value);
            }
            read_session_new_fixtures(root, provider, &mut session_news)?;
            read_session_load_fixtures(root, provider, &mut session_loads)?;
            read_session_prompt_fixtures(root, provider, &mut session_prompts)?;
            read_session_set_config_option_fixtures(
                root,
                provider,
                &mut session_set_config_options,
            )?;
        }
        Ok(Self {
            initializes,
            session_lists,
            session_news,
            session_loads,
            session_prompts,
            session_set_config_options,
        })
    }
}

impl ProviderFactory for FixtureProviderFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(FixtureProviderPort {
            provider,
            initialize_fixture: self.initializes.get(&provider).cloned(),
            initialize_result: None,
            last_prompt: None,
            session_list: self
                .session_lists
                .get(&provider)
                .cloned()
                .unwrap_or_else(empty_session_list),
            session_new: self.session_news.get(&provider).cloned(),
            session_loads: self
                .session_loads
                .iter()
                .filter(|((fixture_provider, _), _)| *fixture_provider == provider)
                .map(|((_, session_id), fixture)| (session_id.clone(), fixture.clone()))
                .collect(),
            session_prompts: self
                .session_prompts
                .iter()
                .filter(|((fixture_provider, _), _)| *fixture_provider == provider)
                .map(|((_, session_id), fixture)| (session_id.clone(), fixture.clone()))
                .collect(),
            session_set_config_options: self
                .session_set_config_options
                .iter()
                .filter(|((fixture_provider, _, _, _), _)| *fixture_provider == provider)
                .map(|((_, session_id, config_id, value), fixture)| {
                    (
                        (session_id.clone(), config_id.clone(), value.clone()),
                        fixture.clone(),
                    )
                })
                .collect(),
            loaded_transcripts: HashMap::new(),
        }))
    }
}

struct FixtureProviderPort {
    provider: ProviderId,
    initialize_fixture: Option<ProviderInitializeResult>,
    initialize_result: Option<ProviderInitializeResult>,
    last_prompt: Option<PromptLifecycleSnapshot>,
    session_list: Value,
    session_new: Option<Value>,
    session_loads: HashMap<String, SessionLoadFixture>,
    session_prompts: HashMap<String, SessionPromptFixture>,
    session_set_config_options: HashMap<(String, String, String), SessionSetConfigOptionFixture>,
    loaded_transcripts: HashMap<String, LoadedTranscriptSnapshot>,
}

impl ProviderPort for FixtureProviderPort {
    fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        let fixture = self.initialize_fixture.clone().ok_or_else(|| {
            RuntimeError::Provider(format!(
                "missing initialize fixture for {}",
                self.provider.as_str()
            ))
        })?;
        if fixture.request != request {
            return Err(RuntimeError::Provider(format!(
                "initialize fixture request mismatch for {}",
                self.provider.as_str()
            )));
        }
        self.initialize_result = Some(fixture.clone());
        Ok(fixture)
    }

    fn initialize_result(&self) -> Result<Option<ProviderInitializeResult>> {
        Ok(self.initialize_result.clone())
    }

    fn snapshot(&self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: if self.initialize_result.is_some() {
                ConnectionState::Ready
            } else {
                ConnectionState::Connected
            },
            discovery: fixture_discovery(self.provider),
            capabilities: self
                .initialize_result
                .as_ref()
                .and_then(|result| serde_json::to_value(&result.response.agent_capabilities).ok())
                .unwrap_or(Value::Null),
            auth_methods: self
                .initialize_result
                .as_ref()
                .and_then(|result| serde_json::to_value(&result.response.auth_methods).ok())
                .and_then(|value| serde_json::from_value(value).ok())
                .unwrap_or_default(),
            live_sessions: Vec::new(),
            last_prompt: self.last_prompt.clone(),
            loaded_transcripts: self.loaded_transcripts.values().cloned().collect(),
        }
    }

    fn raw_events(&self) -> Vec<RawWireEvent> {
        Vec::new()
    }

    fn disconnect(&mut self) -> Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<Value> {
        self.require_initialized("session/new")?;
        self.session_new.clone().ok_or_else(|| {
            RuntimeError::Provider(format!(
                "missing session/new fixture for {}",
                self.provider.as_str()
            ))
        })
    }

    fn session_list(&mut self, _cwd: Option<PathBuf>, cursor: Option<String>) -> Result<Value> {
        self.require_initialized("session/list")?;
        if cursor.is_some() {
            return Ok(empty_session_list());
        }
        Ok(self.session_list.clone())
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
        self.require_initialized("session/load")?;
        let fixture = self
            .session_loads
            .get(&session_id)
            .cloned()
            .ok_or_else(|| {
                RuntimeError::Provider(format!(
                    "missing session/load fixture for {} session {session_id}",
                    self.provider.as_str()
                ))
            })?;
        self.loaded_transcripts
            .insert(session_id, fixture.loaded_transcript);
        Ok(fixture.response)
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        prompt: Vec<Value>,
        update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<Value> {
        self.require_initialized("session/prompt")?;
        let fixture = self
            .session_prompts
            .get(&session_id)
            .cloned()
            .ok_or_else(|| {
                RuntimeError::Provider(format!(
                    "missing session/prompt fixture for {} session {session_id}",
                    self.provider.as_str()
                ))
            })?;
        if fixture.prompt != prompt {
            return Err(RuntimeError::Provider(format!(
                "session/prompt fixture prompt mismatch for {} session {session_id}",
                self.provider.as_str()
            )));
        }
        for update in &fixture.updates {
            update_sink(update.clone());
        }
        self.last_prompt = Some(fixture.lifecycle(self.provider, session_id));
        Ok(fixture.response)
    }

    fn session_cancel(&mut self, _session_id: String) -> Result<Value> {
        unsupported("session/cancel")
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        config_id: String,
        value: String,
    ) -> Result<Value> {
        self.require_initialized("session/set_config_option")?;
        let key = (session_id.clone(), config_id.clone(), value.clone());
        self.session_set_config_options
            .get(&key)
            .map(|fixture| fixture.response.clone())
            .ok_or_else(|| {
                RuntimeError::Provider(format!(
                    "missing session/set_config_option fixture for {} session {session_id} config {config_id} value {value}",
                    self.provider.as_str()
                ))
            })
    }

    fn session_respond_interaction(
        &mut self,
        _session_id: String,
        _interaction_id: String,
        _response: InteractionResponse,
    ) -> Result<Value> {
        unsupported("session/respond_interaction")
    }
}

impl FixtureProviderPort {
    fn require_initialized(&self, operation: &'static str) -> Result<()> {
        if self.initialize_result.is_some() {
            return Ok(());
        }
        Err(RuntimeError::Provider(format!(
            "{operation} requires initialize fixture for {}",
            self.provider.as_str()
        )))
    }
}

fn read_session_list_fixture(path: &Path) -> Result<Value> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    if value.get("sessions").and_then(Value::as_array).is_none() {
        return Err(invalid_fixture(path, "must contain a sessions array"));
    }
    Ok(value)
}

pub(crate) fn read_json(path: &Path) -> Result<Value> {
    let body = read_to_string(path).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to read fixture {}: {source}",
            path.display()
        ))
    })?;
    let value: Value = serde_json::from_str(&body).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to parse fixture {}: {source}",
            path.display()
        ))
    })?;
    Ok(value)
}

fn session_list_path(root: &Path, provider: ProviderId) -> PathBuf {
    root.join(provider.as_str())
        .join("session-list")
        .join("provider.raw.json")
}

fn empty_session_list() -> Value {
    json!({ "sessions": [] })
}

fn unsupported(command: &'static str) -> Result<Value> {
    Err(RuntimeError::UnsupportedCommand(command.to_owned()))
}

pub(crate) fn invalid_fixture(path: &Path, message: &'static str) -> RuntimeError {
    RuntimeError::Provider(format!("invalid fixture {}: {message}", path.display()))
}

fn fixture_discovery(provider: ProviderId) -> ProviderDiscovery {
    ProviderDiscovery {
        provider,
        launcher: LauncherCommand {
            executable: PathBuf::from("provider-fixture"),
            args: Vec::new(),
            display: "provider-fixture".to_owned(),
        },
        resolved_path: "provider-fixture".to_owned(),
        version: "fixture".to_owned(),
        auth_hints: Vec::new(),
        initialize_viable: true,
        transport_diagnostics: Vec::new(),
        initialize_probe: InitializeProbe {
            response: json!({}),
            payload: InitializeResponse::new(ProtocolVersion::V1)
                .agent_info(Implementation::new("fixture-provider", "0.5.0")),
            stdout_lines: Vec::new(),
            stderr_lines: Vec::new(),
            elapsed_ms: 0,
        },
    }
}

#[cfg(test)]
mod tests;
