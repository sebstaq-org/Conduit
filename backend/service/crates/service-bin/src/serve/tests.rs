use super::{OutboundFrame, WatchState, handle_client_text, is_loopback_client};
use crate::serve::actor::RuntimeActor;
use acp_core::{
    ConnectionState, ProviderSnapshot, RawWireEvent, TranscriptUpdateSnapshot, WireKind, WireStream,
};
use acp_discovery::{InitializeProbe, LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{Implementation, InitializeResponse, ProtocolVersion};
use serde_json::json;
use service_runtime::{
    ProviderFactory, ProviderPort, Result, RuntimeError, RuntimeEvent, RuntimeEventKind,
};
use session_store::{HistoryLimit, LocalStore, OpenSessionKey};
use std::error::Error;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc as tokio_mpsc;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Clone)]
struct BlockingPromptFactory {
    release: Arc<(Mutex<bool>, Condvar)>,
    started: mpsc::Sender<()>,
}

struct BlockingPromptProvider {
    provider: ProviderId,
    release: Arc<(Mutex<bool>, Condvar)>,
    started: mpsc::Sender<()>,
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn socket_handler_accepts_following_command_while_prompt_response_is_pending()
-> TestResult<()> {
    let path = test_db_path()?;
    let open_session_id = seed_open_session(&path)?;
    let refresh_path = path.clone();
    let (started, started_rx) = mpsc::channel();
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let actor = RuntimeActor::start_with_store_opener(
        BlockingPromptFactory {
            release: Arc::clone(&release),
            started,
        },
        LocalStore::open_path(&path)?,
        Arc::new(move || Ok(LocalStore::open_path(&refresh_path)?)),
    );
    let watches = Arc::new(tokio::sync::Mutex::new(WatchState::default()));
    let (outbound, mut outbound_rx) = tokio_mpsc::unbounded_channel();

    handle_client_text(
        &actor,
        &command_text(
            "prompt-1",
            "session/prompt",
            "all",
            prompt_params(&open_session_id),
        ),
        Arc::clone(&watches),
        outbound.clone(),
        1,
    );
    started_rx.recv_timeout(Duration::from_secs(5))?;
    handle_client_text(
        &actor,
        &command_text("watch-1", "sessions/watch", "all", json!({})),
        watches,
        outbound,
        1,
    );

    let response = tokio::time::timeout(Duration::from_millis(250), outbound_rx.recv()).await?;
    release_prompt(&release)?;
    ensure_response_id(response, "watch-1")
}

#[test]
fn sessions_watch_projects_only_index_events() -> TestResult<()> {
    let mut watches = WatchState::default();
    watches.apply_command("sessions/watch", &json!({ "subscribed": true }));
    let event = runtime_event(
        RuntimeEventKind::SessionsIndexChanged,
        json!({ "revision": 4 }),
    )?;
    let product_event = watches.product_event(&event)?;

    if serde_json::to_value(product_event)?
        == json!({
            "kind": "sessions_index_changed",
            "revision": 4
        })
    {
        return Ok(());
    }
    Err("sessions watch did not project a minimal index event".into())
}

#[test]
fn session_watch_filters_by_open_session_id() -> TestResult<()> {
    let mut watches = WatchState::default();
    watches.apply_command(
        "session/watch",
        &json!({
            "subscribed": true,
            "openSessionId": "open-session-1"
        }),
    );
    let ignored_event = runtime_event(
        RuntimeEventKind::SessionTimelineChanged,
        json!({
            "openSessionId": "open-session-2",
            "revision": 4
        }),
    )?;
    let projected_event = runtime_event(
        RuntimeEventKind::SessionTimelineChanged,
        json!({
            "openSessionId": "open-session-1",
            "revision": 5
        }),
    )?;
    let ignored = watches.product_event(&ignored_event)?;
    let projected = watches.product_event(&projected_event)?;

    if ignored.is_some() {
        return Err("session watch projected another open session".into());
    }
    if serde_json::to_value(projected)?
        == json!({
            "kind": "session_timeline_changed",
            "openSessionId": "open-session-1",
            "revision": 5
        })
    {
        return Ok(());
    }
    Err("session watch did not project a minimal timeline event".into())
}

#[test]
fn session_watch_ignores_unwatched_timeline_events_before_item_projection() -> TestResult<()> {
    let mut watches = WatchState::default();
    watches.apply_command(
        "session/watch",
        &json!({
            "subscribed": true,
            "openSessionId": "open-session-1"
        }),
    );
    let event = runtime_event(
        RuntimeEventKind::SessionTimelineChanged,
        json!({
            "openSessionId": "open-session-2",
            "revision": 4,
            "items": [{ "kind": "message", "id": "bad", "role": "agent" }]
        }),
    )?;

    if watches.product_event(&event)?.is_none() {
        return Ok(());
    }
    Err("unwatched timeline event should not be projected".into())
}

#[test]
fn session_watch_reports_invalid_watched_timeline_items() -> TestResult<()> {
    let mut watches = WatchState::default();
    watches.apply_command(
        "session/watch",
        &json!({
            "subscribed": true,
            "openSessionId": "open-session-1"
        }),
    );
    let event = runtime_event(
        RuntimeEventKind::SessionTimelineChanged,
        json!({
            "openSessionId": "open-session-1",
            "revision": 4,
            "items": [{ "kind": "message", "id": "bad", "role": "agent" }]
        }),
    )?;

    if watches.product_event(&event).is_err() {
        return Ok(());
    }
    Err("watched invalid timeline items should be an explicit contract error".into())
}

#[test]
fn client_log_ingest_accepts_ipv4_loopback() -> TestResult<()> {
    let client_addr: SocketAddr = "127.0.0.1:4274".parse()?;
    if is_loopback_client(client_addr) {
        return Ok(());
    }
    Err("ipv4 loopback client was rejected".into())
}

#[test]
fn client_log_ingest_rejects_non_loopback_client() -> TestResult<()> {
    let client_addr: SocketAddr = "10.0.0.42:4274".parse()?;
    if !is_loopback_client(client_addr) {
        return Ok(());
    }
    Err("non-loopback client was accepted".into())
}

#[test]
fn client_log_ingest_accepts_ipv6_loopback() -> TestResult<()> {
    let client_addr: SocketAddr = "[::1]:4274".parse()?;
    if is_loopback_client(client_addr) {
        return Ok(());
    }
    Err("ipv6 loopback client was rejected".into())
}

fn runtime_event(kind: RuntimeEventKind, payload: serde_json::Value) -> TestResult<RuntimeEvent> {
    Ok(serde_json::from_value(json!({
        "sequence": 1,
        "kind": kind,
        "provider": "codex",
        "session_id": null,
        "payload": payload
    }))?)
}

impl ProviderFactory for BlockingPromptFactory {
    fn connect(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        Ok(Box::new(BlockingPromptProvider {
            provider,
            release: Arc::clone(&self.release),
            started: self.started.clone(),
        }))
    }
}

impl ProviderPort for BlockingPromptProvider {
    fn snapshot(&self) -> ProviderSnapshot {
        ProviderSnapshot {
            provider: self.provider,
            connection_state: ConnectionState::Ready,
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
            method: Some("session/prompt".to_owned()),
            request_id: Some("1".to_owned()),
            json: Some(json!({})),
        }]
    }

    fn disconnect(&mut self) -> Result<()> {
        Ok(())
    }

    fn session_new(&mut self, _cwd: PathBuf) -> Result<serde_json::Value> {
        Ok(json!({ "sessionId": "session-1" }))
    }

    fn session_list(
        &mut self,
        _cwd: Option<PathBuf>,
        _cursor: Option<String>,
    ) -> Result<serde_json::Value> {
        Ok(json!({ "sessions": [] }))
    }

    fn session_load(&mut self, session_id: String, _cwd: PathBuf) -> Result<serde_json::Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_prompt(
        &mut self,
        session_id: String,
        _prompt: Vec<serde_json::Value>,
        _update_sink: &mut dyn FnMut(TranscriptUpdateSnapshot),
    ) -> Result<serde_json::Value> {
        let _send_status = self.started.send(());
        let (released, condvar) = &*self.release;
        let mut released = released
            .lock()
            .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        while !*released {
            released = condvar
                .wait(released)
                .map_err(|error| RuntimeError::Provider(format!("fake state poisoned: {error}")))?;
        }
        Ok(json!({ "sessionId": session_id, "stopReason": "end_turn" }))
    }

    fn session_cancel(&mut self, session_id: String) -> Result<serde_json::Value> {
        Ok(json!({ "sessionId": session_id }))
    }

    fn session_set_config_option(
        &mut self,
        session_id: String,
        _config_id: String,
        _value: String,
    ) -> Result<serde_json::Value> {
        Ok(json!({
            "sessionId": session_id,
            "configOptions": []
        }))
    }
}

fn ensure_response_id(response: Option<OutboundFrame>, expected_id: &str) -> TestResult<()> {
    match response {
        Some(OutboundFrame::Response { id, response }) if id == expected_id && response.ok => {
            Ok(())
        }
        Some(frame) => Err(format!("unexpected outbound frame: {frame:?}").into()),
        None => Err("outbound channel closed".into()),
    }
}

fn seed_open_session(path: &PathBuf) -> TestResult<String> {
    let mut store = LocalStore::open_path(path)?;
    let opened = store.open_session(
        OpenSessionKey {
            provider: ProviderId::Codex,
            session_id: "session-1".to_owned(),
            cwd: "/repo".to_owned(),
        },
        &[],
        HistoryLimit::new("test", Some(8))?,
    )?;
    Ok(opened.open_session_id)
}

fn command_text(id: &str, command: &str, provider: &str, params: serde_json::Value) -> String {
    json!({
        "v": 1,
        "type": "command",
        "id": id,
        "command": {
            "id": id,
            "command": command,
            "provider": provider,
            "params": params
        }
    })
    .to_string()
}

fn prompt_params(open_session_id: &str) -> serde_json::Value {
    json!({
        "openSessionId": open_session_id,
        "prompt": [{ "type": "text", "text": "user prompt" }]
    })
}

fn release_prompt(release: &Arc<(Mutex<bool>, Condvar)>) -> TestResult<()> {
    let (released, condvar) = &**release;
    *released.lock().map_err(|error| format!("{error}"))? = true;
    condvar.notify_all();
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
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!(
        "conduit-service-bin-socket-{}-{nanos}.sqlite3",
        std::process::id()
    )))
}
