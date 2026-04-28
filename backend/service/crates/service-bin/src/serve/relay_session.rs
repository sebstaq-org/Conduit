use super::text_connection::{SharedWatchState, WatchState};
use remote_access::RelayCipherChannel;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime};
use tokio::sync::Mutex;

const VERIFIED_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum MobileConnectionStatus {
    Idle,
    Waiting,
    Connected,
    Reconnecting,
    Disconnected,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MobileConnectionSnapshot {
    status: MobileConnectionStatus,
    connection_id: Option<String>,
    generation: Option<u64>,
    transport: &'static str,
    verified_at: Option<String>,
    stale_at: Option<String>,
    last_error: Option<String>,
}

#[derive(Clone)]
pub(super) struct RelayDataLease {
    pub(super) connection_id: String,
    pub(super) generation: u64,
    pub(super) watches: SharedWatchState,
    pub(super) cached_cipher: Option<RelayCipherChannel>,
}

struct RelaySession {
    active: bool,
    cipher: Option<RelayCipherChannel>,
    generation: u64,
    last_error: Option<String>,
    status: MobileConnectionStatus,
    verified_at: Option<SystemTime>,
    watches: SharedWatchState,
}

#[derive(Default)]
pub(super) struct RelaySessionManager {
    next_generation: AtomicU64,
    sessions: Mutex<HashMap<String, RelaySession>>,
}

impl RelaySessionManager {
    pub(super) async fn mark_client_waiting(&self, connection_id: &str) {
        let mut sessions = self.sessions.lock().await;
        let session = session_entry(&mut sessions, connection_id);
        session.status = if fresh_verified(session, SystemTime::now()) {
            MobileConnectionStatus::Reconnecting
        } else {
            MobileConnectionStatus::Waiting
        };
        session.last_error = None;
    }

    pub(super) async fn begin_data_socket(&self, connection_id: &str) -> Option<RelayDataLease> {
        let mut sessions = self.sessions.lock().await;
        let session = session_entry(&mut sessions, connection_id);
        if session.active {
            return None;
        }
        let generation = self
            .next_generation
            .fetch_add(1, Ordering::Relaxed)
            .saturating_add(1);
        session.active = true;
        session.generation = generation;
        session.status = if fresh_verified(session, SystemTime::now()) {
            MobileConnectionStatus::Reconnecting
        } else {
            MobileConnectionStatus::Waiting
        };
        session.last_error = None;
        Some(RelayDataLease {
            cached_cipher: session.cipher.take(),
            connection_id: connection_id.to_owned(),
            generation,
            watches: Arc::clone(&session.watches),
        })
    }

    pub(super) async fn cache_cipher(
        &self,
        connection_id: &str,
        generation: u64,
        cipher: &RelayCipherChannel,
    ) {
        let mut sessions = self.sessions.lock().await;
        let Some(session) = sessions.get_mut(connection_id) else {
            return;
        };
        if session.generation == generation {
            session.cipher = Some(cipher.clone());
        }
    }

    pub(super) async fn mark_verified(&self, connection_id: &str, generation: u64) {
        let mut sessions = self.sessions.lock().await;
        let Some(session) = sessions.get_mut(connection_id) else {
            return;
        };
        if session.generation != generation {
            return;
        }
        session.status = MobileConnectionStatus::Connected;
        session.verified_at = Some(SystemTime::now());
        session.last_error = None;
    }

    pub(super) async fn finish_data_socket(
        &self,
        lease: &RelayDataLease,
        cipher: Option<RelayCipherChannel>,
        error: Option<String>,
    ) {
        let mut sessions = self.sessions.lock().await;
        let Some(session) = sessions.get_mut(&lease.connection_id) else {
            return;
        };
        if session.generation != lease.generation {
            return;
        }
        session.active = false;
        if session.status == MobileConnectionStatus::Disconnected {
            return;
        }
        if let Some(cipher) = cipher {
            session.cipher = Some(cipher);
        }
        if let Some(error) = error {
            session.last_error = Some(error);
        }
        session.status = if fresh_verified(session, SystemTime::now()) {
            MobileConnectionStatus::Reconnecting
        } else {
            MobileConnectionStatus::Disconnected
        };
    }

    pub(super) async fn mark_data_closed(&self, connection_id: &str) {
        let mut sessions = self.sessions.lock().await;
        let Some(session) = sessions.get_mut(connection_id) else {
            return;
        };
        session.active = false;
        if session.status == MobileConnectionStatus::Disconnected {
            return;
        }
        session.status = if fresh_verified(session, SystemTime::now()) {
            MobileConnectionStatus::Reconnecting
        } else {
            MobileConnectionStatus::Disconnected
        };
    }

    pub(super) async fn mark_client_closed(&self, connection_id: &str) {
        let mut sessions = self.sessions.lock().await;
        let session = session_entry(&mut sessions, connection_id);
        session.active = false;
        session.cipher = None;
        session.status = MobileConnectionStatus::Disconnected;
        session.last_error = None;
    }

    pub(super) async fn snapshot(&self, now: SystemTime) -> MobileConnectionSnapshot {
        let sessions = self.sessions.lock().await;
        let selected = sessions.iter().max_by_key(|(_connection_id, session)| {
            session
                .verified_at
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
        });
        let Some((connection_id, session)) = selected else {
            return MobileConnectionSnapshot::idle();
        };
        let status = snapshot_status(session, now);
        MobileConnectionSnapshot {
            connection_id: Some(connection_id.clone()),
            generation: Some(session.generation),
            last_error: session.last_error.clone(),
            stale_at: session.verified_at.map(stale_at_string),
            status,
            transport: "relay",
            verified_at: session.verified_at.map(time_string),
        }
    }
}

impl MobileConnectionSnapshot {
    fn idle() -> Self {
        Self {
            connection_id: None,
            generation: None,
            last_error: None,
            stale_at: None,
            status: MobileConnectionStatus::Idle,
            transport: "relay",
            verified_at: None,
        }
    }
}

fn session_entry<'a>(
    sessions: &'a mut HashMap<String, RelaySession>,
    connection_id: &str,
) -> &'a mut RelaySession {
    sessions
        .entry(connection_id.to_owned())
        .or_insert_with(|| RelaySession {
            active: false,
            cipher: None,
            generation: 0,
            last_error: None,
            status: MobileConnectionStatus::Waiting,
            verified_at: None,
            watches: Arc::new(Mutex::new(WatchState::default())),
        })
}

fn snapshot_status(session: &RelaySession, now: SystemTime) -> MobileConnectionStatus {
    if session.status == MobileConnectionStatus::Connected && fresh_verified(session, now) {
        return MobileConnectionStatus::Connected;
    }
    if session.status == MobileConnectionStatus::Reconnecting && fresh_verified(session, now) {
        return MobileConnectionStatus::Reconnecting;
    }
    if session.active {
        return MobileConnectionStatus::Reconnecting;
    }
    match session.status {
        MobileConnectionStatus::Connected | MobileConnectionStatus::Reconnecting => {
            MobileConnectionStatus::Disconnected
        }
        status => status,
    }
}

fn fresh_verified(session: &RelaySession, now: SystemTime) -> bool {
    session
        .verified_at
        .and_then(|verified_at| now.duration_since(verified_at).ok())
        .is_some_and(|age| age <= VERIFIED_TIMEOUT)
}

fn stale_at_string(verified_at: SystemTime) -> String {
    time_string(verified_at + VERIFIED_TIMEOUT)
}

fn time_string(time: SystemTime) -> String {
    time::OffsetDateTime::from(time).to_string()
}
