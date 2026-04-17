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
    ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use load::{SessionLoadFixture, read_session_load_fixtures};
use new::read_session_new_fixtures;
use prompt::{SessionPromptFixture, read_session_prompt_fixtures};
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, ProviderPort, Result, RuntimeError};
use std::collections::HashMap;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};

mod load;
mod new;
mod prompt;

const PROVIDERS: [ProviderId; 3] = [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex];

/// Fixture-backed provider factory keyed by provider id.
#[derive(Debug, Clone)]
pub struct FixtureProviderFactory {
    session_lists: HashMap<ProviderId, Value>,
    session_news: HashMap<ProviderId, Value>,
    session_loads: HashMap<(ProviderId, String), SessionLoadFixture>,
    session_prompts: HashMap<(ProviderId, String), SessionPromptFixture>,
}

impl FixtureProviderFactory {
    /// Loads fixture-backed provider data from a fixture root.
    ///
    /// # Errors
    ///
    /// Returns an error when an existing fixture file cannot be read, cannot be
    /// parsed as JSON, or does not contain a top-level `sessions` array.
    pub fn load(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref();
        if !root.is_dir() {
            return Err(RuntimeError::Provider(format!(
                "fixture root {} must be an existing directory",
                root.display()
            )));
        }
        let mut session_lists = HashMap::new();
        let mut session_news = HashMap::new();
        let mut session_loads = HashMap::new();
        let mut session_prompts = HashMap::new();
        for provider in PROVIDERS {
            let path = session_list_path(root, provider);
            if path.exists() {
                let value = read_session_list_fixture(&path)?;
                session_lists.insert(provider, value);
            }
            read_session_new_fixtures(root, provider, &mut session_news)?;
            read_session_load_fixtures(root, provider, &mut session_loads)?;
            read_session_prompt_fixtures(root, provider, &mut session_prompts)?;
        }
        Ok(Self {
            session_lists,
            session_news,
            session_loads,
            session_prompts,
        })
    }
}

impl ProviderFactory for FixtureProviderFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(FixtureProviderPort {
            provider,
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
            loaded_transcripts: HashMap::new(),
        }))
    }
}

struct FixtureProviderPort {
    provider: ProviderId,
    last_prompt: Option<PromptLifecycleSnapshot>,
    session_list: Value,
    session_new: Option<Value>,
    session_loads: HashMap<String, SessionLoadFixture>,
    session_prompts: HashMap<String, SessionPromptFixture>,
    loaded_transcripts: HashMap<String, LoadedTranscriptSnapshot>,
}

impl ProviderPort for FixtureProviderPort {
    fn snapshot(&self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: ConnectionState::Ready,
            discovery: fixture_discovery(self.provider),
            capabilities: json!({}),
            auth_methods: Vec::new(),
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
        self.session_new.clone().ok_or_else(|| {
            RuntimeError::Provider(format!(
                "missing session/new fixture for {}",
                self.provider.as_str()
            ))
        })
    }

    fn session_list(&mut self, _cwd: Option<PathBuf>, cursor: Option<String>) -> Result<Value> {
        if cursor.is_some() {
            return Ok(empty_session_list());
        }
        Ok(self.session_list.clone())
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<Value> {
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
        _session_id: String,
        _config_id: String,
        _value: String,
    ) -> Result<Value> {
        unsupported("session/set_config_option")
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
mod tests {
    use super::FixtureProviderFactory;
    use acp_core::InteractionResponse;
    use acp_discovery::ProviderId;
    use serde_json::{Value, json};
    use service_runtime::{ConsumerCommand, ProviderFactory, RuntimeError, ServiceRuntime};
    use session_store::LocalStore;
    use std::fs::{create_dir_all, write};
    use tempfile::TempDir;

    type TestResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

    #[test]
    fn codex_session_list_returns_raw_fixture() -> TestResult<()> {
        let root = fixture_root(json!({
            "sessions": [{ "sessionId": "session-1", "cwd": "/repo" }],
            "nextCursor": "cursor-1"
        }))?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let response = port.session_list(None, None)?;

        if response.get("nextCursor").and_then(Value::as_str) != Some("cursor-1") {
            return Err(format!("unexpected response {response}").into());
        }
        Ok(())
    }

    #[test]
    fn cursor_pages_terminate_after_raw_fixture_page() -> TestResult<()> {
        let root = fixture_root(json!({
            "sessions": [{ "sessionId": "session-1", "cwd": "/repo" }],
            "nextCursor": "cursor-1"
        }))?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let response = port.session_list(None, Some("cursor-1".to_owned()))?;

        if response != json!({ "sessions": [] }) {
            return Err(format!("unexpected cursor response {response}").into());
        }
        Ok(())
    }

    #[test]
    fn missing_provider_fixture_returns_empty_session_list() -> TestResult<()> {
        let root = TempDir::new()?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Claude)?;
        let response = port.session_list(None, None)?;

        if response != json!({ "sessions": [] }) {
            return Err(format!("unexpected response {response}").into());
        }
        Ok(())
    }

    #[test]
    fn malformed_session_list_fixture_fails_load() -> TestResult<()> {
        let root = fixture_root(json!({ "nextCursor": null }))?;
        let error = FixtureProviderFactory::load(root.path())
            .err()
            .ok_or("malformed fixture unexpectedly loaded")?;

        if !error.to_string().contains("sessions array") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn codex_session_new_returns_raw_fixture() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_new_capture(
            root.path(),
            "capture-1",
            json!({
                "sessionId": "session-1",
                "configOptions": [],
                "modes": { "availableModes": [], "currentModeId": null },
                "models": null
            }),
        )?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let response = port.session_new("/repo".into())?;

        if response.get("sessionId").and_then(Value::as_str) != Some("session-1") {
            return Err(format!("unexpected response {response}").into());
        }
        Ok(())
    }

    #[test]
    fn missing_session_new_fixture_fails_explicitly() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let error = port
            .session_new("/repo".into())
            .err()
            .ok_or("missing session/new unexpectedly succeeded")?;

        if !error.to_string().contains("missing session/new fixture") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn duplicate_session_new_fixture_fails_load() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        for capture in ["capture-1", "capture-2"] {
            write_session_new_capture(root.path(), capture, json!({ "sessionId": capture }))?;
        }
        let error = FixtureProviderFactory::load(root.path())
            .err()
            .ok_or("duplicate session/new fixture unexpectedly loaded")?;

        if !error.to_string().contains("duplicate session/new fixture") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn malformed_session_new_fixture_fails_load() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_new_capture(root.path(), "capture-1", json!({ "models": null }))?;
        let error = FixtureProviderFactory::load(root.path())
            .err()
            .ok_or("malformed session/new fixture unexpectedly loaded")?;

        if !error.to_string().contains("sessionId string") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn session_load_indexes_capture_with_manifest_session_id() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_load_capture(
            root.path(),
            SessionLoadCapture {
                capture: "capture-1",
                session_id: "session-1",
                manifest_session_id: Some("session-1"),
                response: json!({ "configOptions": [], "modes": [] }),
                updates: vec![transcript_update(0, "agent_message_chunk", "loaded")],
            },
        )?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;

        let response = port.session_load("session-1".to_owned(), "/repo".into())?;
        if response
            .pointer("/configOptions")
            .and_then(Value::as_array)
            .is_none()
        {
            return Err(format!("unexpected session/load response {response}").into());
        }
        let snapshot = port.snapshot();
        if snapshot
            .loaded_transcripts
            .first()
            .and_then(|transcript| transcript.updates.first())
            .map(|update| update.variant.as_str())
            != Some("agent_message_chunk")
        {
            return Err(format!("unexpected snapshot {snapshot:?}").into());
        }
        Ok(())
    }

    #[test]
    fn session_load_indexes_capture_from_loaded_transcript_identity() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_load_capture(
            root.path(),
            SessionLoadCapture {
                capture: "capture-1",
                session_id: "session-1",
                manifest_session_id: None,
                response: json!({ "configOptions": [] }),
                updates: Vec::new(),
            },
        )?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;

        let response = port.session_load("session-1".to_owned(), "/repo".into())?;
        if response
            .pointer("/configOptions")
            .and_then(Value::as_array)
            .is_some()
        {
            return Ok(());
        }
        Err(format!("unexpected session/load response {response}").into())
    }

    #[test]
    fn duplicate_session_load_fixture_fails_load() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        for capture in ["capture-1", "capture-2"] {
            write_session_load_capture(
                root.path(),
                SessionLoadCapture {
                    capture,
                    session_id: "session-1",
                    manifest_session_id: Some("session-1"),
                    response: json!({ "configOptions": [] }),
                    updates: Vec::new(),
                },
            )?;
        }
        let error = FixtureProviderFactory::load(root.path())
            .err()
            .ok_or("duplicate session/load fixture unexpectedly loaded")?;

        if !error
            .to_string()
            .contains("duplicate session/load session id")
        {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn missing_session_load_fixture_fails_explicitly() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let error = port
            .session_load("missing-session".to_owned(), "/repo".into())
            .err()
            .ok_or("missing session/load unexpectedly succeeded")?;

        if !error.to_string().contains("missing session/load fixture") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn session_prompt_replays_updates_and_lifecycle() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_prompt_capture(
            root.path(),
            SessionPromptCapture {
                capture: "default",
                prompt: vec![json!({ "type": "text", "text": "hello" })],
                response: json!({ "stopReason": "end_turn" }),
                session_id: "session-1",
                updates: vec![transcript_update(0, "agent_message_chunk", "reply")],
            },
        )?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let mut updates = Vec::new();

        let response = port.session_prompt(
            "session-1".to_owned(),
            vec![json!({ "type": "text", "text": "hello" })],
            &mut |update| updates.push(update),
        )?;

        if response.get("stopReason").and_then(Value::as_str) != Some("end_turn") {
            return Err(format!("unexpected response {response}").into());
        }
        if updates.first().map(|update| update.variant.as_str()) != Some("agent_message_chunk") {
            return Err(format!("unexpected updates {updates:?}").into());
        }
        if port
            .snapshot()
            .last_prompt
            .and_then(|prompt| prompt.agent_text_chunks.first().cloned())
            .as_deref()
            != Some("reply")
        {
            return Err("expected prompt lifecycle agent text chunk".into());
        }
        Ok(())
    }

    #[test]
    fn session_prompt_rejects_prompt_mismatch() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_prompt_capture(
            root.path(),
            SessionPromptCapture {
                capture: "default",
                prompt: vec![json!({ "type": "text", "text": "expected" })],
                response: json!({ "stopReason": "end_turn" }),
                session_id: "session-1",
                updates: Vec::new(),
            },
        )?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;
        let error = port
            .session_prompt(
                "session-1".to_owned(),
                vec![json!({ "type": "text", "text": "actual" })],
                &mut |_| {},
            )
            .err()
            .ok_or("prompt mismatch unexpectedly succeeded")?;

        if !error.to_string().contains("prompt mismatch") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn malformed_session_load_fixture_fails_load() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        let dir = root.path().join("codex/session-load/capture-1");
        create_dir_all(&dir)?;
        write(dir.join("provider.raw.json"), "{}")?;
        let error = FixtureProviderFactory::load(root.path())
            .err()
            .ok_or("malformed session/load fixture unexpectedly loaded")?;

        if !error.to_string().contains("response field") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn fixture_root_must_exist() -> TestResult<()> {
        let root = TempDir::new()?;
        let missing = root.path().join("missing");
        let error = FixtureProviderFactory::load(&missing)
            .err()
            .ok_or("missing fixture root unexpectedly loaded")?;

        if !error.to_string().contains("existing directory") {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    #[test]
    fn unsupported_methods_return_unsupported_command() -> TestResult<()> {
        let root = TempDir::new()?;
        let mut factory = FixtureProviderFactory::load(root.path())?;
        let mut port = factory.connect(ProviderId::Codex)?;

        assert_unsupported(
            port.session_cancel("session-1".to_owned()),
            "session/cancel",
        )?;
        assert_unsupported(
            port.session_set_config_option(
                "session-1".to_owned(),
                "mode".to_owned(),
                "default".to_owned(),
            ),
            "session/set_config_option",
        )?;
        assert_unsupported(
            port.session_respond_interaction(
                "session-1".to_owned(),
                "interaction-1".to_owned(),
                InteractionResponse::Cancelled,
            ),
            "session/respond_interaction",
        )
    }

    #[test]
    fn runtime_session_list_and_grouped_use_fixture_provider() -> TestResult<()> {
        let root = fixture_root(json!({
            "sessions": [{
                "sessionId": "session-1",
                "cwd": "/repo",
                "title": "Fixture session",
                "updatedAt": "9999-01-01T00:00:00Z"
            }],
            "nextCursor": "cursor-1"
        }))?;
        let factory = FixtureProviderFactory::load(root.path())?;
        let mut store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
        store.add_project("/repo")?;
        let mut runtime = ServiceRuntime::with_factory(factory, store);

        let listed = runtime.dispatch(command("list", "session/list", "codex", json!({})));
        if listed
            .result
            .pointer("/sessions/0/sessionId")
            .and_then(Value::as_str)
            != Some("session-1")
        {
            return Err(format!("unexpected session/list result {}", listed.result).into());
        }

        runtime.force_refresh_session_index("all")?;
        let grouped = runtime.dispatch(command(
            "grouped",
            "sessions/grouped",
            "all",
            json!({ "updatedWithinDays": null }),
        ));
        if grouped
            .result
            .pointer("/groups/0/sessions/0/sessionId")
            .and_then(Value::as_str)
            != Some("session-1")
        {
            return Err(format!("unexpected sessions/grouped result {}", grouped.result).into());
        }
        Ok(())
    }

    #[test]
    fn runtime_session_open_uses_session_load_fixture_transcript() -> TestResult<()> {
        let root = fixture_root(json!({
            "sessions": [{
                "sessionId": "session-1",
                "cwd": "/repo",
                "title": "Fixture session",
                "updatedAt": "9999-01-01T00:00:00Z"
            }]
        }))?;
        write_session_load_capture(
            root.path(),
            SessionLoadCapture {
                capture: "capture-1",
                session_id: "session-1",
                manifest_session_id: Some("session-1"),
                response: json!({ "configOptions": [], "modes": [] }),
                updates: vec![transcript_update(0, "agent_message_chunk", "loaded")],
            },
        )?;
        let factory = FixtureProviderFactory::load(root.path())?;
        let mut store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
        store.add_project("/repo")?;
        let mut runtime = ServiceRuntime::with_factory(factory, store);

        let opened = runtime.dispatch(command(
            "open",
            "session/open",
            "codex",
            json!({
                "sessionId": "session-1",
                "cwd": "/repo",
                "limit": 40
            }),
        ));
        if !opened.ok {
            return Err(format!("session/open failed: {opened:?}").into());
        }
        if opened.result.pointer("/sessionId").and_then(Value::as_str) != Some("session-1") {
            return Err(format!("unexpected session/open result {}", opened.result).into());
        }
        if !value_contains_string(&opened.result, "loaded") {
            return Err(format!("session/open did not expose transcript {}", opened.result).into());
        }
        Ok(())
    }

    #[test]
    fn runtime_session_new_and_prompt_use_fixture_provider() -> TestResult<()> {
        let root = fixture_root(json!({ "sessions": [] }))?;
        write_session_new_capture(
            root.path(),
            "default",
            json!({
                "sessionId": "session-1",
                "configOptions": [],
                "modes": { "availableModes": [], "currentModeId": null },
                "models": null
            }),
        )?;
        write_session_prompt_capture(
            root.path(),
            SessionPromptCapture {
                capture: "default",
                prompt: vec![json!({ "type": "text", "text": "hello" })],
                response: json!({ "stopReason": "end_turn" }),
                session_id: "session-1",
                updates: vec![transcript_update(0, "agent_message_chunk", "fixture-ready")],
            },
        )?;
        let factory = FixtureProviderFactory::load(root.path())?;
        let store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
        let mut runtime = ServiceRuntime::with_factory(factory, store);

        let created = runtime.dispatch(command(
            "new",
            "session/new",
            "codex",
            json!({ "cwd": "/repo", "limit": 40 }),
        ));
        if !created.ok {
            return Err(format!("session/new failed: {created:?}").into());
        }
        let open_session_id = created
            .result
            .pointer("/history/openSessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("missing openSessionId: {}", created.result))?;

        let prompted = runtime.dispatch(command(
            "prompt",
            "session/prompt",
            "all",
            json!({
                "openSessionId": open_session_id,
                "prompt": [{ "type": "text", "text": "hello" }]
            }),
        ));
        if !prompted.ok {
            return Err(format!("session/prompt failed: {prompted:?}").into());
        }
        let history = runtime.dispatch(command(
            "history",
            "session/history",
            "all",
            json!({ "openSessionId": open_session_id, "limit": 40 }),
        ));
        if !value_contains_string(&history.result, "fixture-ready") {
            return Err(format!("history did not expose prompt fixture {}", history.result).into());
        }
        Ok(())
    }

    fn assert_unsupported(result: service_runtime::Result<Value>, command: &str) -> TestResult<()> {
        let error = result
            .err()
            .ok_or_else(|| format!("{command} unexpectedly succeeded"))?;
        if !matches!(error, RuntimeError::UnsupportedCommand(ref error_command) if error_command == command)
        {
            return Err(format!("unexpected error {error}").into());
        }
        Ok(())
    }

    fn command(id: &str, name: &str, provider: &str, params: Value) -> ConsumerCommand {
        ConsumerCommand {
            id: id.to_owned(),
            command: name.to_owned(),
            provider: provider.to_owned(),
            params,
        }
    }

    fn fixture_root(value: Value) -> TestResult<TempDir> {
        let root = TempDir::new()?;
        let dir = root.path().join("codex/session-list");
        create_dir_all(&dir)?;
        write(
            dir.join("provider.raw.json"),
            serde_json::to_string(&value)?,
        )?;
        Ok(root)
    }

    struct SessionLoadCapture<'a> {
        capture: &'a str,
        session_id: &'a str,
        manifest_session_id: Option<&'a str>,
        response: Value,
        updates: Vec<acp_core::TranscriptUpdateSnapshot>,
    }

    fn write_session_load_capture(
        root: &std::path::Path,
        capture: SessionLoadCapture<'_>,
    ) -> TestResult<()> {
        let dir = root.join("codex/session-load").join(capture.capture);
        create_dir_all(&dir)?;
        if let Some(manifest_session_id) = capture.manifest_session_id {
            write(
                dir.join("manifest.json"),
                serde_json::to_string(&json!({
                    "operation": "session/load",
                    "provider": "codex",
                    "sessionId": manifest_session_id
                }))?,
            )?;
        }
        write(
            dir.join("provider.raw.json"),
            serde_json::to_string(&json!({
                "response": capture.response,
                "loadedTranscript": {
                    "identity": {
                        "provider": "codex",
                        "acpSessionId": capture.session_id
                    },
                    "rawUpdateCount": capture.updates.len(),
                    "updates": capture.updates
                }
            }))?,
        )?;
        Ok(())
    }

    fn write_session_new_capture(
        root: &std::path::Path,
        capture: &str,
        response: Value,
    ) -> TestResult<()> {
        let dir = root.join("codex/session-new").join(capture);
        create_dir_all(&dir)?;
        write(
            dir.join("provider.raw.json"),
            serde_json::to_string(&response)?,
        )?;
        Ok(())
    }

    struct SessionPromptCapture<'a> {
        capture: &'a str,
        prompt: Vec<Value>,
        response: Value,
        session_id: &'a str,
        updates: Vec<acp_core::TranscriptUpdateSnapshot>,
    }

    fn write_session_prompt_capture(
        root: &std::path::Path,
        capture: SessionPromptCapture<'_>,
    ) -> TestResult<()> {
        let dir = root
            .join("codex/session-prompt")
            .join(capture.session_id)
            .join(capture.capture);
        create_dir_all(&dir)?;
        write(
            dir.join("manifest.json"),
            serde_json::to_string(&json!({
                "operation": "session/prompt",
                "provider": "codex",
                "sessionId": capture.session_id
            }))?,
        )?;
        write(
            dir.join("provider.raw.json"),
            serde_json::to_string(&json!({
                "promptRequest": {
                    "sessionId": capture.session_id,
                    "prompt": capture.prompt
                },
                "promptResponse": capture.response,
                "promptUpdates": capture.updates
            }))?,
        )?;
        Ok(())
    }

    fn transcript_update(
        index: usize,
        variant: &str,
        text: &str,
    ) -> acp_core::TranscriptUpdateSnapshot {
        acp_core::TranscriptUpdateSnapshot {
            index,
            variant: variant.to_owned(),
            update: json!({
                "sessionUpdate": variant,
                "content": { "type": "text", "text": text }
            }),
        }
    }

    fn value_contains_string(value: &Value, expected: &str) -> bool {
        match value {
            Value::String(value) => value.contains(expected),
            Value::Array(values) => values
                .iter()
                .any(|value| value_contains_string(value, expected)),
            Value::Object(values) => values
                .values()
                .any(|value| value_contains_string(value, expected)),
            Value::Null | Value::Bool(_) | Value::Number(_) => false,
        }
    }
}
