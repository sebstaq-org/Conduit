//! Relay route capability helpers.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;
use thiserror::Error;

const ROUTING_FILE_NAME: &str = "relay-routing.json";
const ROUTING_VERSION: u8 = 1;
const RELAY_PROTOCOL_VERSION: u8 = 1;
const RELAY_CAPABILITY_BYTES: usize = 32;
const RELAY_CAPABILITY_ENCODED_LENGTH: usize = 43;
const RELAY_WEBSOCKET_PROTOCOL_PREFIX: &str = "conduit-relay.v1.";
const CONCURRENT_CREATE_RETRIES: usize = 20;

/// Persistent daemon relay routing material.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayRouting {
    /// Secret daemon capability sent only as a WebSocket subprotocol.
    pub daemon_capability: String,
    /// Public relay server route id derived from the daemon capability.
    pub server_id: String,
}

/// Relay control frame sent from the relay control socket.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum RelayControlFrame {
    /// A client is connected or has buffered data waiting for a daemon data socket.
    ClientWaiting {
        /// Offer-bound relay connection route id.
        #[serde(rename = "connectionId")]
        connection_id: String,
        /// Relay control protocol version.
        v: u8,
    },
    /// The daemon data socket closed.
    DataClosed {
        /// Offer-bound relay connection route id.
        #[serde(rename = "connectionId")]
        connection_id: String,
        /// Relay control protocol version.
        v: u8,
    },
    /// The mobile client socket closed.
    ClientClosed {
        /// Offer-bound relay connection route id.
        #[serde(rename = "connectionId")]
        connection_id: String,
        /// Relay control protocol version.
        v: u8,
    },
}

/// Errors raised by relay routing support.
#[derive(Debug, Error)]
pub enum RelayRouteError {
    /// Relay routing file I/O failed.
    #[error("relay routing io failed for {path}: {source}")]
    Io {
        /// Path involved in the failed operation.
        path: PathBuf,
        /// Underlying I/O error.
        source: std::io::Error,
    },
    /// Relay routing data was invalid.
    #[error("relay routing data is invalid: {message}")]
    Invalid {
        /// Human-readable validation details.
        message: String,
    },
    /// Relay routing JSON was invalid.
    #[error("relay routing json failed for {path}: {source}")]
    Json {
        /// Path involved in the failed JSON operation.
        path: PathBuf,
        /// Underlying JSON error.
        source: serde_json::Error,
    },
}

/// Relay URL fields.
#[derive(Debug, Clone, Copy)]
pub struct RelayUrlOptions<'a> {
    /// Public HTTP(S) relay endpoint.
    pub endpoint: &'a str,
    /// Capability used by the caller.
    pub capability: &'a str,
    /// Public relay server route id.
    pub server_id: &'a str,
    /// Relay role query value.
    pub role: &'a str,
    /// Optional connection route id for client/data sockets.
    pub connection_id: Option<&'a str>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredRelayRouting {
    v: u8,
    daemon_capability: String,
}

/// Loads or creates persistent relay daemon routing under `home`.
///
/// # Errors
///
/// Returns an error when the routing file is unreadable, invalid, or cannot be
/// created.
pub fn load_or_create_relay_routing(home: &Path) -> Result<RelayRouting, RelayRouteError> {
    fs::create_dir_all(home).map_err(|source| RelayRouteError::Io {
        path: home.to_path_buf(),
        source,
    })?;
    let path = home.join(ROUTING_FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(raw) => parse_stored_routing_with_retry(&path, raw),
        Err(error) if error.kind() == ErrorKind::NotFound => create_routing(&path),
        Err(source) => Err(RelayRouteError::Io { path, source }),
    }
}

fn create_routing(path: &Path) -> Result<RelayRouting, RelayRouteError> {
    let stored = StoredRelayRouting {
        v: ROUTING_VERSION,
        daemon_capability: generate_relay_capability(),
    };
    if let Err(error) = write_secret_file(path, &stored) {
        if is_already_exists(&error) {
            return read_routing_after_concurrent_create(path);
        }
        return Err(error);
    }
    routing_from_stored(stored)
}

fn read_routing_after_concurrent_create(path: &Path) -> Result<RelayRouting, RelayRouteError> {
    let raw = fs::read_to_string(path).map_err(|source| RelayRouteError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    parse_stored_routing_with_retry(path, raw)
}

fn parse_stored_routing_with_retry(
    path: &Path,
    raw: String,
) -> Result<RelayRouting, RelayRouteError> {
    let mut current = raw;
    for attempt in 0..=CONCURRENT_CREATE_RETRIES {
        match parse_stored_routing(path, &current) {
            Ok(value) => return Ok(value),
            Err(error)
                if is_probable_concurrent_create_read(&error)
                    && attempt < CONCURRENT_CREATE_RETRIES =>
            {
                std::thread::sleep(Duration::from_millis(5));
                current = fs::read_to_string(path).map_err(|source| RelayRouteError::Io {
                    path: path.to_path_buf(),
                    source,
                })?;
            }
            Err(error) => return Err(error),
        }
    }
    parse_stored_routing(path, &current)
}

fn parse_stored_routing(path: &Path, raw: &str) -> Result<RelayRouting, RelayRouteError> {
    let stored: StoredRelayRouting =
        serde_json::from_str(raw).map_err(|source| RelayRouteError::Json {
            path: path.to_path_buf(),
            source,
        })?;
    routing_from_stored(stored)
}

fn routing_from_stored(stored: StoredRelayRouting) -> Result<RelayRouting, RelayRouteError> {
    if stored.v != ROUTING_VERSION {
        return Err(invalid("unsupported relay routing version"));
    }
    assert_relay_capability(&stored.daemon_capability)?;
    Ok(RelayRouting {
        server_id: derive_relay_server_id(&stored.daemon_capability)?,
        daemon_capability: stored.daemon_capability,
    })
}

/// Generates one random relay route capability.
#[must_use]
pub fn generate_relay_capability() -> String {
    let mut bytes = [0_u8; RELAY_CAPABILITY_BYTES];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Derives the public client connection route id from `client_capability`.
///
/// # Errors
///
/// Returns an error when `client_capability` is not a relay capability.
pub fn derive_relay_connection_id(client_capability: &str) -> Result<String, RelayRouteError> {
    assert_relay_capability(client_capability)?;
    Ok(format!(
        "conn_{}",
        digest_route_id("client", client_capability)
    ))
}

/// Derives the public daemon server route id from `daemon_capability`.
///
/// # Errors
///
/// Returns an error when `daemon_capability` is not a relay capability.
pub fn derive_relay_server_id(daemon_capability: &str) -> Result<String, RelayRouteError> {
    assert_relay_capability(daemon_capability)?;
    Ok(format!(
        "srv_{}",
        digest_route_id("server", daemon_capability)
    ))
}

/// Builds the WebSocket subprotocol carrying a relay capability.
///
/// # Errors
///
/// Returns an error when `capability` is not a relay capability.
pub fn build_relay_websocket_protocol(capability: &str) -> Result<String, RelayRouteError> {
    assert_relay_capability(capability)?;
    Ok(format!("{RELAY_WEBSOCKET_PROTOCOL_PREFIX}{capability}"))
}

/// Builds one relay WebSocket URL.
///
/// # Errors
///
/// Returns an error when any route field is invalid or the endpoint cannot be
/// converted to a WebSocket URL.
pub fn build_relay_websocket_url(options: RelayUrlOptions<'_>) -> Result<String, RelayRouteError> {
    assert_relay_capability(options.capability)?;
    assert_route_id(options.server_id, "serverId")?;
    if let Some(connection_id) = options.connection_id {
        assert_route_id(connection_id, "connectionId")?;
    }
    let mut endpoint = options.endpoint.trim().trim_end_matches('/').to_owned();
    if endpoint.starts_with("https://") {
        endpoint.replace_range(0..8, "wss://");
    } else if endpoint.starts_with("http://") {
        endpoint.replace_range(0..7, "ws://");
    } else {
        return Err(invalid(
            "relay endpoint must start with http:// or https://",
        ));
    }
    let mut url = format!(
        "{endpoint}/v1/relay/{}?role={}",
        options.server_id, options.role
    );
    if let Some(connection_id) = options.connection_id {
        url.push_str("&connectionId=");
        url.push_str(connection_id);
    }
    Ok(url)
}

/// Parses a relay control socket frame.
///
/// # Errors
///
/// Returns an error when the frame is invalid or uses an unsupported protocol
/// version.
pub fn parse_relay_control_frame(text: &str) -> Result<RelayControlFrame, RelayRouteError> {
    let frame: RelayControlFrame =
        serde_json::from_str(text).map_err(|source| RelayRouteError::Json {
            path: PathBuf::from("<relay-control-frame>"),
            source,
        })?;
    let version = match &frame {
        RelayControlFrame::ClientWaiting { v, .. }
        | RelayControlFrame::DataClosed { v, .. }
        | RelayControlFrame::ClientClosed { v, .. } => *v,
    };
    if version != RELAY_PROTOCOL_VERSION {
        return Err(invalid("unsupported relay control protocol version"));
    }
    Ok(frame)
}

fn digest_route_id(kind: &str, capability: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("conduit-relay-route:{kind}:{capability}"));
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn assert_relay_capability(value: &str) -> Result<(), RelayRouteError> {
    let is_valid = value.len() == RELAY_CAPABILITY_ENCODED_LENGTH
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        });
    if is_valid {
        return Ok(());
    }
    Err(invalid("relay capability is invalid"))
}

fn assert_route_id(value: &str, field: &str) -> Result<(), RelayRouteError> {
    let is_valid = !value.is_empty()
        && value.len() <= 128
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || character == '.'
                || character == '_'
                || character == ':'
                || character == '-'
        });
    if is_valid {
        return Ok(());
    }
    Err(invalid(&format!("relay {field} is invalid")))
}

fn write_secret_file<T: Serialize>(path: &Path, value: &T) -> Result<(), RelayRouteError> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|source| RelayRouteError::Json {
        path: path.to_path_buf(),
        source,
    })?;
    let mut bytes_with_newline = bytes;
    bytes_with_newline.push(b'\n');
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|source| RelayRouteError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    std::io::Write::write_all(&mut file, &bytes_with_newline).map_err(|source| {
        RelayRouteError::Io {
            path: path.to_path_buf(),
            source,
        }
    })
}

fn invalid(message: &str) -> RelayRouteError {
    RelayRouteError::Invalid {
        message: message.to_owned(),
    }
}

fn is_already_exists(error: &RelayRouteError) -> bool {
    matches!(
        error,
        RelayRouteError::Io { source, .. } if source.kind() == ErrorKind::AlreadyExists
    )
}

fn is_probable_concurrent_create_read(error: &RelayRouteError) -> bool {
    matches!(
        error,
        RelayRouteError::Json { source, .. }
            if source.to_string().contains("EOF while parsing a value")
    )
}
