//! Product presence tracked for desktop/mobile connection UI.

use serde::Serialize;
use serde_json::{Value, json};
use service_runtime::{ConsumerError, ConsumerResponse};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

const CLIENT_TIMEOUT: Duration = Duration::from_secs(45);
const DEFAULT_HOST_DISPLAY_NAME: &str = "Conduit Desktop";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum PresenceDeviceKind {
    Mobile,
    Web,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum PresenceTransport {
    Direct,
    Relay,
}

#[derive(Debug, Clone)]
struct PresenceClient {
    active_sessions: HashSet<String>,
    client_id: String,
    display_name: String,
    device_kind: PresenceDeviceKind,
    last_seen_at: SystemTime,
    transport: PresenceTransport,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PresenceHostSnapshot {
    server_id: String,
    display_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PresenceClientSnapshot {
    client_id: String,
    display_name: String,
    device_kind: PresenceDeviceKind,
    connected: bool,
    last_seen_at: String,
    transport: PresenceTransport,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PresenceSnapshot {
    host: PresenceHostSnapshot,
    clients: Vec<PresenceClientSnapshot>,
}

#[derive(Debug, Default)]
pub(crate) struct PresenceStore {
    clients: Mutex<HashMap<String, PresenceClient>>,
}

pub(super) enum PresenceCommandOutcome {
    Handled(Box<ConsumerResponse>),
    NotPresence,
}

impl PresenceStore {
    pub(super) fn handle_command(
        &self,
        command: &service_runtime::ConsumerCommand,
        transport: PresenceTransport,
        session_id: Option<&str>,
    ) -> PresenceCommandOutcome {
        if command.command != "presence/update" {
            return PresenceCommandOutcome::NotPresence;
        }
        PresenceCommandOutcome::Handled(Box::new(
            match self.update(command, transport, session_id) {
                Ok(result) => ConsumerResponse {
                    id: command.id.clone(),
                    ok: true,
                    result,
                    error: None,
                    snapshot: None,
                },
                Err(message) => ConsumerResponse {
                    id: command.id.clone(),
                    ok: false,
                    result: Value::Null,
                    error: Some(ConsumerError {
                        code: "invalid_presence".to_owned(),
                        message,
                    }),
                    snapshot: None,
                },
            },
        ))
    }

    pub(super) fn mark_session_closed(&self, session_id: &str) {
        let Ok(mut clients) = self.clients.lock() else {
            return;
        };
        for client in clients.values_mut() {
            client.active_sessions.remove(session_id);
        }
    }

    pub(super) fn mobile_connected(&self, now: SystemTime) -> bool {
        self.clients.lock().is_ok_and(|clients| {
            clients.values().any(|client| {
                client.device_kind == PresenceDeviceKind::Mobile && client.connected(now)
            })
        })
    }

    pub(super) fn snapshot_json(&self, server_id: &str, now: SystemTime) -> Value {
        let snapshot = self.snapshot(server_id, now);
        match serde_json::to_value(snapshot) {
            Ok(value) => value,
            Err(error) => json!({
                "host": { "serverId": server_id, "displayName": DEFAULT_HOST_DISPLAY_NAME },
                "clients": [],
                "error": error.to_string()
            }),
        }
    }

    fn update(
        &self,
        command: &service_runtime::ConsumerCommand,
        transport: PresenceTransport,
        session_id: Option<&str>,
    ) -> Result<Value, String> {
        let client_id = required_string(&command.params, "clientId")?;
        let display_name = required_string(&command.params, "displayName")?;
        let device_kind = required_device_kind(&command.params)?;
        let now = SystemTime::now();
        let mut clients = self
            .clients
            .lock()
            .map_err(|error| format!("presence store is unavailable: {error}"))?;
        let client = clients
            .entry(client_id.clone())
            .or_insert_with(|| PresenceClient {
                active_sessions: HashSet::new(),
                client_id: client_id.clone(),
                display_name: display_name.clone(),
                device_kind,
                last_seen_at: now,
                transport,
            });
        client.display_name = display_name;
        client.device_kind = device_kind;
        client.last_seen_at = now;
        client.transport = transport;
        if let Some(session_id) = session_id {
            client.active_sessions.insert(session_id.to_owned());
        }
        Ok(json!({ "accepted": true }))
    }

    fn snapshot(&self, server_id: &str, now: SystemTime) -> PresenceSnapshot {
        let mut clients = self
            .clients
            .lock()
            .map(|clients| {
                clients
                    .values()
                    .map(|client| client.snapshot(now))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        clients.sort_by(|left, right| left.display_name.cmp(&right.display_name));
        PresenceSnapshot {
            host: PresenceHostSnapshot {
                server_id: server_id.to_owned(),
                display_name: DEFAULT_HOST_DISPLAY_NAME.to_owned(),
            },
            clients,
        }
    }
}

impl PresenceClient {
    fn connected(&self, now: SystemTime) -> bool {
        !self.active_sessions.is_empty()
            && now
                .duration_since(self.last_seen_at)
                .map(|age| age <= CLIENT_TIMEOUT)
                .unwrap_or(true)
    }

    fn snapshot(&self, now: SystemTime) -> PresenceClientSnapshot {
        PresenceClientSnapshot {
            client_id: self.client_id.clone(),
            display_name: self.display_name.clone(),
            device_kind: self.device_kind,
            connected: self.connected(now),
            last_seen_at: time::OffsetDateTime::from(self.last_seen_at).to_string(),
            transport: self.transport,
        }
    }
}

fn required_string(params: &Value, field: &'static str) -> Result<String, String> {
    params
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("presence/update parameter {field} is required"))
}

fn required_device_kind(params: &Value) -> Result<PresenceDeviceKind, String> {
    match params.get("deviceKind").and_then(Value::as_str) {
        Some("mobile") => Ok(PresenceDeviceKind::Mobile),
        Some("web") => Ok(PresenceDeviceKind::Web),
        Some(_) => Err("presence/update parameter deviceKind is invalid".to_owned()),
        None => Err("presence/update parameter deviceKind is required".to_owned()),
    }
}

pub(super) fn presence_transport(connection_kind: &'static str) -> PresenceTransport {
    if connection_kind == "relay" {
        PresenceTransport::Relay
    } else {
        PresenceTransport::Direct
    }
}

#[cfg(test)]
mod tests {
    use super::{PresenceStore, PresenceTransport};
    use serde_json::json;
    use service_runtime::ConsumerCommand;
    use std::error::Error;
    use std::time::{Duration, SystemTime};

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    fn presence_command(id: &str) -> ConsumerCommand {
        ConsumerCommand {
            id: id.to_owned(),
            command: "presence/update".to_owned(),
            provider: "all".to_owned(),
            params: json!({
                "clientId": "client-1",
                "displayName": "Base iPhone",
                "deviceKind": "mobile"
            }),
        }
    }

    #[test]
    fn snapshot_marks_recent_client_connected() -> TestResult<()> {
        let store = PresenceStore::default();
        let response = match store.handle_command(
            &presence_command("p1"),
            PresenceTransport::Relay,
            Some("session-1"),
        ) {
            super::PresenceCommandOutcome::Handled(response) => response,
            super::PresenceCommandOutcome::NotPresence => {
                return Err("presence was not handled".into());
            }
        };
        if !response.ok {
            return Err("presence update failed".into());
        }
        let snapshot = store.snapshot_json("srv_host", SystemTime::now());
        if snapshot["clients"][0]["connected"] == json!(true) {
            return Ok(());
        }
        Err("client was not connected".into())
    }

    #[test]
    fn snapshot_marks_stale_client_disconnected_after_timeout() -> TestResult<()> {
        let store = PresenceStore::default();
        let response = match store.handle_command(
            &presence_command("p1"),
            PresenceTransport::Relay,
            Some("session-1"),
        ) {
            super::PresenceCommandOutcome::Handled(response) => response,
            super::PresenceCommandOutcome::NotPresence => {
                return Err("presence was not handled".into());
            }
        };
        if !response.ok {
            return Err("presence update failed".into());
        }
        let later = SystemTime::now() + Duration::from_secs(46);
        let snapshot = store.snapshot_json("srv_host", later);
        if snapshot["clients"][0]["connected"] == json!(false) {
            return Ok(());
        }
        Err("client did not time out".into())
    }

    #[test]
    fn invalid_device_kind_is_rejected() -> TestResult<()> {
        let store = PresenceStore::default();
        let mut command = presence_command("p1");
        command.params["deviceKind"] = json!("desktop");
        let response =
            match store.handle_command(&command, PresenceTransport::Direct, Some("session-1")) {
                super::PresenceCommandOutcome::Handled(response) => response,
                super::PresenceCommandOutcome::NotPresence => {
                    return Err("presence was not handled".into());
                }
            };
        if !response.ok
            && response
                .error
                .as_ref()
                .is_some_and(|error| error.code == "invalid_presence")
        {
            return Ok(());
        }
        Err("invalid presence was not rejected".into())
    }
}
