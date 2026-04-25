//! WebSocket product service for the consumer runtime API.

mod actor;
mod catalog;
mod client_logs;
mod presence;
mod relay;
mod text_connection;
mod wire;

use crate::error::Result;
use crate::home::product_home;
use crate::identity::{daemon_status_response, pairing_response};
use crate::local_store::open_store;
use acp_discovery::{ProviderId, resolve_provider_command};
use actor::RuntimeActor;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use service_runtime::{AppServiceFactory, ProviderFactory};
use session_store::LocalStore;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use telemetry_support::TelemetryHealth;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tower_http::cors::CorsLayer;

use text_connection::{TextConnectionRuntime, run_text_connection};

static NEXT_CONNECTION_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct ServeState {
    actor: RuntimeActor,
    client_log_sink: client_logs::ClientLogSink,
    product_home: PathBuf,
    relay_endpoint: Option<String>,
    app_base_url: String,
    telemetry_health: TelemetryHealth,
    mobile_peer_connections: Arc<AtomicUsize>,
    presence: Arc<presence::PresenceStore>,
}

/// Runs the versioned consumer WebSocket service.
///
/// # Errors
///
/// Returns an error when the TCP listener cannot bind or the server exits with
/// an I/O failure.
#[expect(
    clippy::too_many_arguments,
    reason = "Serve keeps CLI-owned configuration explicit at the executable boundary."
)]
pub(crate) async fn run(
    host: &str,
    port: u16,
    relay_endpoint: Option<String>,
    app_base_url: String,
    provider_fixtures: Option<PathBuf>,
    store_path: Option<PathBuf>,
    telemetry_health: TelemetryHealth,
) -> Result<()> {
    let listener = TcpListener::bind((host, port)).await?;
    let product_home = product_home()?;
    let local_store = open_store(store_path.clone())?;
    let store_opener = store_opener(store_path);
    if let Some(root) = provider_fixtures {
        let factory = provider_fixture::FixtureProviderFactory::load(&root).map_err(|source| {
            crate::error::ServiceError::InvalidFlagValue {
                flag: "--provider-fixtures".to_owned(),
                value: root.display().to_string(),
                message: source.to_string(),
            }
        })?;
        return serve_router(
            listener,
            router_with_factory(
                factory,
                local_store,
                store_opener,
                product_home,
                relay_endpoint,
                app_base_url,
                telemetry_health,
            ),
        )
        .await;
    }
    validate_managed_codex_adapter()?;
    serve_router(
        listener,
        router(
            local_store,
            store_opener,
            product_home,
            relay_endpoint,
            app_base_url,
            telemetry_health,
        ),
    )
    .await
}

fn validate_managed_codex_adapter() -> Result<()> {
    let command = resolve_provider_command(ProviderId::Codex).map_err(|error| {
        tracing::error!(
            event_name = "managed_codex_acp.missing",
            source = "service-bin",
            error_message = %error
        );
        error
    })?;
    tracing::info!(
        event_name = "managed_codex_acp.ready",
        source = "service-bin",
        executable = %command.executable.display()
    );
    Ok(())
}

async fn serve_router(listener: TcpListener, router: Router) -> Result<()> {
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

#[expect(
    clippy::too_many_arguments,
    reason = "Router construction keeps injected runtime dependencies explicit for tests and serve wiring."
)]
fn router(
    local_store: LocalStore,
    store_opener: actor::StoreOpener,
    product_home: PathBuf,
    relay_endpoint: Option<String>,
    app_base_url: String,
    telemetry_health: TelemetryHealth,
) -> Router {
    router_with_actor(
        RuntimeActor::start_with_store_opener(
            AppServiceFactory::default(),
            local_store,
            store_opener,
        ),
        product_home,
        relay_endpoint,
        app_base_url,
        telemetry_health,
    )
}

fn store_opener(path: Option<PathBuf>) -> actor::StoreOpener {
    Arc::new(move || open_store(path.clone()))
}

#[expect(
    clippy::too_many_arguments,
    reason = "Router tests inject provider factories while preserving the production serve configuration shape."
)]
fn router_with_factory<F>(
    factory: F,
    local_store: LocalStore,
    store_opener: actor::StoreOpener,
    product_home: PathBuf,
    relay_endpoint: Option<String>,
    app_base_url: String,
    telemetry_health: TelemetryHealth,
) -> Router
where
    F: Clone + ProviderFactory + 'static,
{
    router_with_actor(
        RuntimeActor::start_with_store_opener(factory, local_store, store_opener),
        product_home,
        relay_endpoint,
        app_base_url,
        telemetry_health,
    )
}

fn router_with_actor(
    actor: RuntimeActor,
    product_home: PathBuf,
    relay_endpoint: Option<String>,
    app_base_url: String,
    telemetry_health: TelemetryHealth,
) -> Router {
    let client_log_sink = client_logs::ClientLogSink::detect();
    let mobile_peer_connections = Arc::new(AtomicUsize::new(0));
    let presence = Arc::new(presence::PresenceStore::default());
    if let Some(endpoint) = relay_endpoint.clone() {
        relay::spawn_relay_connector(
            endpoint,
            product_home.clone(),
            actor.clone(),
            Arc::clone(&mobile_peer_connections),
            Arc::clone(&presence),
        );
    }
    Router::new()
        .route("/health", get(health))
        .route("/api/catalog", get(catalog::catalog))
        .route("/api/daemon/status", get(daemon_status))
        .route("/api/pairing", get(pairing))
        .route("/api/session", get(session_socket))
        .route("/api/client-log", post(client_log_ingest))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(ServeState {
            actor,
            client_log_sink,
            product_home,
            relay_endpoint,
            app_base_url,
            telemetry_health,
            mobile_peer_connections,
            presence,
        }))
}

async fn health(State(state): State<Arc<ServeState>>) -> impl IntoResponse {
    let (status, payload) = health_response(state.telemetry_health.status());
    (status, Json(payload))
}

fn health_response(
    telemetry_status: telemetry_support::TelemetryStatus,
) -> (StatusCode, serde_json::Value) {
    if telemetry_status.ok {
        return (
            StatusCode::OK,
            json!({
                "ok": true,
                "service": "conduit-service",
                "transport": "websocket",
            }),
        );
    }
    (
        StatusCode::SERVICE_UNAVAILABLE,
        json!({
            "ok": false,
            "service": "conduit-service",
            "transport": "websocket",
            "error_code": telemetry_status.error_code.unwrap_or("telemetry_unavailable"),
            "error_message": telemetry_status
                .error_message
                .unwrap_or_else(|| "telemetry sink unavailable".to_owned()),
        }),
    )
}

async fn daemon_status(State(state): State<Arc<ServeState>>) -> impl IntoResponse {
    match daemon_status_response(&state.product_home, state.relay_endpoint.clone()) {
        Ok(status) => {
            let mut payload = json!(status);
            if let Some(object) = payload.as_object_mut() {
                object.insert(
                    "mobilePeerConnected".to_owned(),
                    json!(state.mobile_peer_connections.load(Ordering::Relaxed) > 0),
                );
                if let Some(server_id) = object.get("serverId").and_then(serde_json::Value::as_str)
                {
                    object.insert(
                        "presence".to_owned(),
                        state
                            .presence
                            .snapshot_json(server_id, std::time::SystemTime::now()),
                    );
                }
            }
            (StatusCode::OK, Json(payload)).into_response()
        }
        Err(error) => {
            tracing::warn!(
                event_name = "daemon_status.failed",
                source = "service-bin",
                error = ?error
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
                .into_response()
        }
    }
}

async fn pairing(State(state): State<Arc<ServeState>>) -> impl IntoResponse {
    let Some(endpoint) = state.relay_endpoint.as_deref() else {
        return (
            StatusCode::CONFLICT,
            Json(json!({
                "error": "missing relay endpoint; set CONDUIT_RELAY_ENDPOINT"
            })),
        )
            .into_response();
    };
    match pairing_response(&state.product_home, endpoint, &state.app_base_url) {
        Ok(response) => (StatusCode::OK, Json(json!(response))).into_response(),
        Err(error) => {
            tracing::warn!(
                event_name = "pairing.failed",
                source = "service-bin",
                error = ?error
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
                .into_response()
        }
    }
}

async fn session_socket(
    State(state): State<Arc<ServeState>>,
    websocket: WebSocketUpgrade,
) -> impl IntoResponse {
    websocket.on_upgrade(move |socket| handle_socket(socket, state))
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Client-log ingest validates client scope and maps sink outcomes to HTTP status with telemetry."
)]
async fn client_log_ingest(
    State(state): State<Arc<ServeState>>,
    ConnectInfo(client_addr): ConnectInfo<SocketAddr>,
    Json(batch): Json<client_logs::ClientLogBatch>,
) -> StatusCode {
    if !is_loopback_client(client_addr) {
        tracing::warn!(
            event_name = "client_log.ingest.rejected",
            source = "service-bin",
            reason = "non_loopback_client",
            client_addr = %client_addr
        );
        return StatusCode::FORBIDDEN;
    }

    let record_count = batch.record_count();
    match state.client_log_sink.append(batch).await {
        Ok(()) => {
            tracing::debug!(
                event_name = "client_log.ingest.ok",
                source = "service-bin",
                record_count
            );
            StatusCode::NO_CONTENT
        }
        Err(error) => {
            let status = if error.is_payload_error() {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            tracing::warn!(
                event_name = "client_log.ingest.failed",
                source = "service-bin",
                status = status.as_u16(),
                record_count,
                error = ?error
            );
            status
        }
    }
}

fn is_loopback_client(client_addr: SocketAddr) -> bool {
    client_addr.ip().is_loopback()
}

#[allow(
    clippy::cognitive_complexity,
    reason = "Socket loop coordinates client frames, outbound queue, and lifecycle telemetry."
)]
async fn handle_socket(socket: WebSocket, state: Arc<ServeState>) {
    let connection_id = NEXT_CONNECTION_ID.fetch_add(1, Ordering::Relaxed);
    let (mut sender, mut receiver) = socket.split();
    let (inbound_text, inbound_receiver) = mpsc::unbounded_channel::<String>();
    let (outbound_text, mut outbound_receiver) = mpsc::unbounded_channel::<String>();
    let inbound_task = tokio::spawn(async move {
        while let Some(Ok(message)) = receiver.next().await {
            let Ok(text) = message.to_text() else {
                return;
            };
            if inbound_text.send(text.to_owned()).is_err() {
                return;
            }
        }
    });
    let outbound_task = tokio::spawn(async move {
        while let Some(text) = outbound_receiver.recv().await {
            if sender.send(Message::Text(text.into())).await.is_err() {
                return;
            }
        }
    });
    run_text_connection(
        TextConnectionRuntime::direct(&state),
        inbound_receiver,
        outbound_text,
        connection_id,
    )
    .await;
    inbound_task.abort();
    outbound_task.abort();
}

#[cfg(test)]
mod tests;
