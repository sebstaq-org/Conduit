//! Relay socket lifecycle wiring for the consumer runtime.

use super::actor::RuntimeActor;
use super::run_text_connection;
use crate::identity::load_daemon_secret_key_b64;
use futures_util::{SinkExt, StreamExt};
use remote_access::{
    IssuedRelayOfferContext, RelayCipherChannel, RelayCipherContext, RelayControlFrame,
    RelayRouting, RelayUrlOptions, accept_client_handshake, build_relay_websocket_protocol,
    build_relay_websocket_url, load_or_create_relay_routing, lookup_relay_offer,
    mark_relay_offer_accepted, parse_relay_control_frame,
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::Ordering;
use thiserror::Error;
use time::OffsetDateTime;
use tokio::net::TcpStream;
use tokio::sync::{Mutex, mpsc};
use tokio::time::{Duration, sleep};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::SEC_WEBSOCKET_PROTOCOL;
use tokio_tungstenite::tungstenite::http::{HeaderValue, Request};
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

type RelaySocket = WebSocketStream<MaybeTlsStream<TcpStream>>;
type RelayResult<T> = std::result::Result<T, RelayConnectorError>;

const CONTROL_RETRY_INITIAL_MS: u64 = 500;
const CONTROL_RETRY_MAX_MS: u64 = 30_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RelayRetrySchedule {
    attempt: u32,
    delay: Duration,
    warn: bool,
}

#[derive(Debug, Default)]
struct RelayControlBackoff {
    failures: u32,
}

impl RelayControlBackoff {
    fn reset(&mut self) {
        self.failures = 0;
    }

    fn record_failure(&mut self) -> RelayRetrySchedule {
        self.failures = self.failures.saturating_add(1);
        let exponent = self.failures.saturating_sub(1).min(16);
        let multiplier = 1_u64 << exponent;
        let delay_ms = CONTROL_RETRY_INITIAL_MS
            .saturating_mul(multiplier)
            .min(CONTROL_RETRY_MAX_MS);
        RelayRetrySchedule {
            attempt: self.failures,
            delay: Duration::from_millis(delay_ms),
            warn: self.failures == 1 || delay_ms == CONTROL_RETRY_MAX_MS,
        }
    }
}

#[derive(Default)]
struct ConnectorState {
    active_connections: Mutex<HashSet<String>>,
    channels: Mutex<std::collections::HashMap<String, RelayCipherChannel>>,
}

#[derive(Debug, Error)]
enum RelayConnectorError {
    #[error(transparent)]
    Identity(#[from] crate::identity::DaemonIdentityError),
    #[error(transparent)]
    Offer(#[from] remote_access::RelayOfferStoreError),
    #[error(transparent)]
    Route(#[from] remote_access::RelayRouteError),
    #[error(transparent)]
    Cipher(#[from] remote_access::RelayCipherError),
    #[error(transparent)]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),
    #[error("relay websocket protocol header is invalid: {0}")]
    InvalidHeader(#[from] tokio_tungstenite::tungstenite::http::header::InvalidHeaderValue),
    #[error("relay client did not send a handshake frame")]
    MissingHandshake,
}

pub(super) fn spawn_relay_connector(endpoint: String, home: PathBuf, actor: RuntimeActor) {
    tokio::spawn(async move {
        run_connector(endpoint, home, actor).await;
    });
}

async fn run_connector(endpoint: String, home: PathBuf, actor: RuntimeActor) {
    let connector_state = Arc::new(ConnectorState::default());
    let mut backoff = RelayControlBackoff::default();
    loop {
        let result = run_control_socket(
            &endpoint,
            &home,
            actor.clone(),
            Arc::clone(&connector_state),
        )
        .await;
        let delay = retry_delay_for_control_result(result, &mut backoff);
        sleep(delay).await;
    }
}

fn retry_delay_for_control_result(
    result: RelayResult<()>,
    backoff: &mut RelayControlBackoff,
) -> Duration {
    match result {
        Ok(()) => {
            backoff.reset();
            Duration::from_millis(CONTROL_RETRY_INITIAL_MS)
        }
        Err(error) => {
            let schedule = backoff.record_failure();
            log_control_failure(&error, schedule);
            schedule.delay
        }
    }
}

fn log_control_failure(error: &RelayConnectorError, schedule: RelayRetrySchedule) {
    if schedule.warn {
        log_control_failure_warn(error, schedule.attempt);
    } else {
        log_control_failure_debug(error, schedule.attempt);
    }
    log_control_retry_scheduled(schedule);
}

fn log_control_failure_warn(error: &RelayConnectorError, attempt: u32) {
    tracing::warn!(
        event_name = "relay.control.failed",
        source = "service-bin",
        attempt,
        error = ?error
    );
}

fn log_control_failure_debug(error: &RelayConnectorError, attempt: u32) {
    tracing::debug!(
        event_name = "relay.control.failed",
        source = "service-bin",
        attempt,
        error = ?error
    );
}

fn log_control_retry_scheduled(schedule: RelayRetrySchedule) {
    tracing::info!(
        event_name = "relay.control.retry.scheduled",
        source = "service-bin",
        attempt = schedule.attempt,
        delay_ms = schedule.delay.as_millis() as u64
    );
}

#[expect(
    clippy::cognitive_complexity,
    reason = "Control socket loop owns reconnect-trigger dispatch and must keep relay lifecycle ordering visible."
)]
async fn run_control_socket(
    endpoint: &str,
    home: &Path,
    actor: RuntimeActor,
    connector_state: Arc<ConnectorState>,
) -> RelayResult<()> {
    let routing = load_or_create_relay_routing(home)?;
    let control_url = build_relay_websocket_url(RelayUrlOptions {
        endpoint,
        capability: &routing.daemon_capability,
        server_id: &routing.server_id,
        role: "server",
        connection_id: None,
    })?;
    tracing::info!(
        event_name = "relay.control.connect.start",
        source = "service-bin",
        relay_server_id = %routing.server_id
    );
    let (mut socket, _response) =
        connect_relay_socket(&control_url, &routing.daemon_capability).await?;
    tracing::info!(
        event_name = "relay.control.connect.finish",
        source = "service-bin",
        relay_server_id = %routing.server_id,
        ok = true
    );
    while let Some(message) = socket.next().await {
        let message = message?;
        if let Message::Text(text) = message {
            handle_control_frame(
                endpoint,
                home,
                &routing,
                actor.clone(),
                Arc::clone(&connector_state),
                &text,
            )
            .await?;
        }
    }
    Ok(())
}

#[expect(
    clippy::too_many_arguments,
    reason = "Control frames need explicit endpoint, home, routing, actor, and shared connector state."
)]
async fn handle_control_frame(
    endpoint: &str,
    home: &Path,
    routing: &RelayRouting,
    actor: RuntimeActor,
    connector_state: Arc<ConnectorState>,
    text: &str,
) -> RelayResult<()> {
    let frame = parse_relay_control_frame(text)?;
    match frame {
        RelayControlFrame::ClientWaiting { connection_id, .. } => {
            if !mark_connection_active(&connector_state, &connection_id).await {
                return Ok(());
            }
            let endpoint = endpoint.to_owned();
            let home = home.to_path_buf();
            let routing = routing.clone();
            tokio::spawn(async move {
                let result = run_data_socket(
                    &endpoint,
                    &home,
                    routing,
                    actor,
                    Arc::clone(&connector_state),
                    &connection_id,
                )
                .await;
                connector_state
                    .active_connections
                    .lock()
                    .await
                    .remove(&connection_id);
                if let Err(error) = result {
                    tracing::warn!(
                        event_name = "relay.data.failed",
                        source = "service-bin",
                        connection_id = %connection_id,
                        error = ?error
                    );
                }
            });
        }
        RelayControlFrame::DataClosed { connection_id, .. } => {
            connector_state
                .active_connections
                .lock()
                .await
                .remove(&connection_id);
        }
        RelayControlFrame::ClientClosed { connection_id, .. } => {
            connector_state
                .active_connections
                .lock()
                .await
                .remove(&connection_id);
            connector_state.channels.lock().await.remove(&connection_id);
        }
    }
    Ok(())
}

async fn mark_connection_active(
    connector_state: &Arc<ConnectorState>,
    connection_id: &str,
) -> bool {
    let mut active = connector_state.active_connections.lock().await;
    if active.contains(connection_id) {
        return false;
    }
    active.insert(connection_id.to_owned())
}

#[expect(
    clippy::cognitive_complexity,
    clippy::too_many_arguments,
    clippy::too_many_lines,
    reason = "Data socket loop bridges relay E2EE with the shared consumer runtime and keeps the reconnect state in one place."
)]
async fn run_data_socket(
    endpoint: &str,
    home: &Path,
    routing: RelayRouting,
    actor: RuntimeActor,
    connector_state: Arc<ConnectorState>,
    connection_id: &str,
) -> RelayResult<()> {
    let now = OffsetDateTime::now_utc();
    let Some(offer) = lookup_relay_offer(home, connection_id, now)? else {
        tracing::warn!(
            event_name = "relay.offer.rejected",
            source = "service-bin",
            connection_id = %connection_id,
            reason = "missing_or_expired_offer"
        );
        return Ok(());
    };
    let data_url = build_relay_websocket_url(RelayUrlOptions {
        endpoint,
        capability: &routing.daemon_capability,
        server_id: &routing.server_id,
        role: "server",
        connection_id: Some(connection_id),
    })?;
    let (socket, _response) = connect_relay_socket(&data_url, &routing.daemon_capability).await?;
    let (mut sender, mut receiver) = socket.split();
    let cached_cipher = connector_state.channels.lock().await.remove(connection_id);
    let (mut cipher, initial_plaintext) = open_relay_cipher(
        &mut receiver,
        home,
        &routing.server_id,
        &offer,
        cached_cipher,
    )
    .await?;
    if mark_relay_offer_accepted(home, connection_id, now)?.is_none() {
        tracing::warn!(
            event_name = "relay.offer.accept_failed",
            source = "service-bin",
            connection_id = %connection_id,
            reason = "missing_or_expired_offer"
        );
        return Ok(());
    }
    let (inbound_text, inbound_receiver) = mpsc::unbounded_channel();
    let (outbound_text, mut outbound_receiver) = mpsc::unbounded_channel();
    let runtime_connection_id = super::NEXT_CONNECTION_ID.fetch_add(1, Ordering::Relaxed);
    let runtime_task = tokio::spawn(run_text_connection(
        actor,
        inbound_receiver,
        outbound_text,
        runtime_connection_id,
        "relay",
    ));
    if let Some(plaintext) = initial_plaintext
        && inbound_text.send(plaintext).is_err()
    {
        runtime_task.abort();
        return Ok(());
    }
    loop {
        tokio::select! {
            message = receiver.next() => {
                let Some(message) = message else {
                    break;
                };
                let text = match message? {
                    Message::Text(text) => text,
                    _ => break,
                };
                if let Some(reset_cipher) = try_accept_relay_handshake(
                    home,
                    &routing.server_id,
                    &offer,
                    &text,
                )? {
                    cipher = reset_cipher;
                    continue;
                }
                let plaintext = cipher.decrypt_utf8(&text)?;
                if inbound_text.send(plaintext).is_err() {
                    break;
                }
            }
            outbound = outbound_receiver.recv() => {
                let Some(outbound) = outbound else {
                    break;
                };
                let frame = cipher.encrypt_utf8(&outbound)?;
                sender.send(Message::Text(frame.into())).await?;
            }
        }
    }
    runtime_task.abort();
    connector_state
        .channels
        .lock()
        .await
        .insert(connection_id.to_owned(), cipher);
    Ok(())
}

async fn open_relay_cipher(
    receiver: &mut futures_util::stream::SplitStream<RelaySocket>,
    home: &Path,
    server_id: &str,
    offer: &IssuedRelayOfferContext,
    cached_cipher: Option<RelayCipherChannel>,
) -> RelayResult<(RelayCipherChannel, Option<String>)> {
    let first_text = next_text_frame(receiver).await?;
    if let Some(cipher) = try_accept_relay_handshake(home, server_id, offer, &first_text)? {
        return Ok((cipher, None));
    }
    let Some(mut cipher) = cached_cipher else {
        return Err(RelayConnectorError::MissingHandshake);
    };
    let plaintext = cipher.decrypt_utf8(&first_text)?;
    Ok((cipher, Some(plaintext)))
}

fn try_accept_relay_handshake(
    home: &Path,
    server_id: &str,
    offer: &IssuedRelayOfferContext,
    text: &str,
) -> RelayResult<Option<RelayCipherChannel>> {
    if !looks_like_relay_handshake(text) {
        return Ok(None);
    }
    let secret_key_b64 = load_daemon_secret_key_b64(home)?;
    let cipher = accept_client_handshake(
        RelayCipherContext {
            server_id: server_id.to_owned(),
            connection_id: offer.connection_id.clone(),
            offer_nonce: offer.nonce.clone(),
        },
        &secret_key_b64,
        text,
    )?;
    Ok(Some(cipher))
}

fn looks_like_relay_handshake(text: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(text)
        .ok()
        .and_then(|value| value.get("type")?.as_str().map(str::to_owned))
        .is_some_and(|frame_type| frame_type == "handshake")
}

async fn next_text_frame(
    receiver: &mut futures_util::stream::SplitStream<RelaySocket>,
) -> RelayResult<String> {
    while let Some(message) = receiver.next().await {
        if let Message::Text(text) = message? {
            return Ok(text.to_string());
        }
    }
    Err(RelayConnectorError::MissingHandshake)
}

async fn connect_relay_socket(
    url: &str,
    capability: &str,
) -> RelayResult<(
    RelaySocket,
    tokio_tungstenite::tungstenite::handshake::client::Response,
)> {
    let request = relay_request(url, capability)?;
    let connected = connect_async(request).await?;
    Ok(connected)
}

fn relay_request(url: &str, capability: &str) -> RelayResult<Request<()>> {
    let mut request = url.into_client_request()?;
    let protocol = build_relay_websocket_protocol(capability)?;
    request
        .headers_mut()
        .insert(SEC_WEBSOCKET_PROTOCOL, HeaderValue::from_str(&protocol)?);
    Ok(request)
}

#[cfg(test)]
mod tests {
    use super::{CONTROL_RETRY_MAX_MS, RelayControlBackoff};

    #[test]
    fn control_backoff_grows_to_maximum() {
        let mut backoff = RelayControlBackoff::default();

        let delays: Vec<u128> = (0..8)
            .map(|_index| backoff.record_failure().delay.as_millis())
            .collect();

        assert_eq!(
            delays,
            vec![500, 1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]
        );
    }

    #[test]
    fn control_backoff_marks_first_and_max_attempts_for_warning() {
        let mut backoff = RelayControlBackoff::default();

        assert!(backoff.record_failure().warn);
        assert!(!backoff.record_failure().warn);
        while backoff.record_failure().delay.as_millis() < u128::from(CONTROL_RETRY_MAX_MS) {}

        assert!(backoff.record_failure().warn);
    }

    #[test]
    fn control_backoff_resets_after_success() {
        let mut backoff = RelayControlBackoff::default();
        let _first = backoff.record_failure();
        let _second = backoff.record_failure();

        backoff.reset();

        assert_eq!(backoff.record_failure().delay.as_millis(), 500);
    }
}
