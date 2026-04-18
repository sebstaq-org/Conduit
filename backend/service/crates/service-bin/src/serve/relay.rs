//! Relay socket lifecycle wiring for the consumer runtime.

use super::actor::RuntimeActor;
use super::run_text_connection;
use crate::identity::load_daemon_secret_key_b64;
use futures_util::{SinkExt, StreamExt};
use remote_access::{
    RelayCipherChannel, RelayCipherContext, RelayControlFrame, RelayRouting, RelayUrlOptions,
    accept_client_handshake, build_relay_websocket_protocol, build_relay_websocket_url,
    load_or_create_relay_routing, lookup_relay_offer, parse_relay_control_frame,
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
    loop {
        if let Err(error) = run_control_socket(
            &endpoint,
            &home,
            actor.clone(),
            Arc::clone(&connector_state),
        )
        .await
        {
            tracing::warn!(
                event_name = "relay.control.failed",
                source = "service-bin",
                error = ?error
            );
        }
        sleep(Duration::from_millis(500)).await;
    }
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
    let Some(offer) = lookup_relay_offer(home, connection_id, OffsetDateTime::now_utc())? else {
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
    let mut cipher = match connector_state.channels.lock().await.remove(connection_id) {
        Some(channel) => channel,
        None => {
            let handshake_text = next_text_frame(&mut receiver).await?;
            let secret_key_b64 = load_daemon_secret_key_b64(home)?;
            accept_client_handshake(
                RelayCipherContext {
                    server_id: routing.server_id,
                    connection_id: offer.connection_id,
                    offer_nonce: offer.nonce,
                },
                &secret_key_b64,
                &handshake_text,
            )?
        }
    };
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
