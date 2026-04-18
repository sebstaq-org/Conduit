//! Issued relay offer persistence.

use crate::route::{
    RelayRouteError, derive_relay_connection_id, generate_relay_capability,
    load_or_create_relay_routing,
};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use thiserror::Error;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

const OFFERS_DIR_NAME: &str = "relay-offers";
const OFFER_VERSION: u8 = 1;

/// Public relay fields attached to a pairing offer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IssuedRelayOffer {
    /// Relay endpoint copied from service configuration.
    pub endpoint: String,
    /// Public relay server route id derived from the daemon capability.
    pub server_id: String,
    /// Offer-bound client capability carried only in the offer fragment.
    pub client_capability: String,
    /// Public relay connection route id derived from the client capability.
    pub connection_id: String,
}

/// Server-side context for an issued relay offer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IssuedRelayOfferContext {
    /// Offer-bound relay connection route id.
    pub connection_id: String,
    /// Offer nonce used in the E2EE key derivation context.
    pub nonce: String,
    /// Expiration timestamp for accepting this offer.
    pub expires_at: String,
}

/// Errors raised by issued relay offer persistence.
#[derive(Debug, Error)]
pub enum RelayOfferStoreError {
    /// Relay route support failed.
    #[error(transparent)]
    Route(#[from] RelayRouteError),
    /// Offer store I/O failed.
    #[error("relay offer store io failed for {path}: {source}")]
    Io {
        /// Path involved in the failed operation.
        path: PathBuf,
        /// Underlying I/O error.
        source: std::io::Error,
    },
    /// Offer store JSON failed.
    #[error("relay offer store json failed for {path}: {source}")]
    Json {
        /// Path involved in the failed JSON operation.
        path: PathBuf,
        /// Underlying JSON error.
        source: serde_json::Error,
    },
    /// Offer data was invalid.
    #[error("relay offer is invalid: {message}")]
    Invalid {
        /// Human-readable validation details.
        message: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredRelayOffer {
    v: u8,
    connection_id: String,
    nonce: String,
    expires_at: String,
}

/// Issues one offer-bound relay client capability and persists the daemon-side
/// nonce lookup record.
///
/// # Errors
///
/// Returns an error when routing material or the issued-offer record cannot be
/// read, validated, or written.
pub fn issue_relay_offer(
    home: &Path,
    endpoint: &str,
    nonce: &str,
    expires_at: &str,
) -> Result<IssuedRelayOffer, RelayOfferStoreError> {
    cleanup_expired_offers(home, OffsetDateTime::now_utc())?;
    let routing = load_or_create_relay_routing(home)?;
    let client_capability = generate_relay_capability();
    let connection_id = derive_relay_connection_id(&client_capability)?;
    let stored = StoredRelayOffer {
        v: OFFER_VERSION,
        connection_id: connection_id.clone(),
        nonce: nonce.to_owned(),
        expires_at: expires_at.to_owned(),
    };
    write_offer(home, &stored)?;
    Ok(IssuedRelayOffer {
        endpoint: endpoint.to_owned(),
        server_id: routing.server_id,
        client_capability,
        connection_id,
    })
}

/// Looks up daemon-side context for an issued relay offer.
///
/// # Errors
///
/// Returns an error when the stored offer exists but is malformed or expired.
pub fn lookup_relay_offer(
    home: &Path,
    connection_id: &str,
    now: OffsetDateTime,
) -> Result<Option<IssuedRelayOfferContext>, RelayOfferStoreError> {
    let path = offer_path(home, connection_id);
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(source) => return Err(RelayOfferStoreError::Io { path, source }),
    };
    let stored = parse_offer(&path, &raw)?;
    if parse_expires_at(&stored.expires_at)? <= now {
        let _ignored = fs::remove_file(&path);
        return Ok(None);
    }
    Ok(Some(IssuedRelayOfferContext {
        connection_id: stored.connection_id,
        nonce: stored.nonce,
        expires_at: stored.expires_at,
    }))
}

fn cleanup_expired_offers(home: &Path, now: OffsetDateTime) -> Result<(), RelayOfferStoreError> {
    let dir = offers_dir(home);
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(source) => return Err(RelayOfferStoreError::Io { path: dir, source }),
    };
    for entry in entries {
        let entry = entry.map_err(|source| RelayOfferStoreError::Io {
            path: offers_dir(home),
            source,
        })?;
        cleanup_entry_if_expired(&entry.path(), now)?;
    }
    Ok(())
}

fn cleanup_entry_if_expired(path: &Path, now: OffsetDateTime) -> Result<(), RelayOfferStoreError> {
    if path.extension().and_then(std::ffi::OsStr::to_str) != Some("json") {
        return Ok(());
    }
    let raw = fs::read_to_string(path).map_err(|source| RelayOfferStoreError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let stored = parse_offer(path, &raw)?;
    if parse_expires_at(&stored.expires_at)? <= now {
        let _ignored = fs::remove_file(path);
    }
    Ok(())
}

fn write_offer(home: &Path, stored: &StoredRelayOffer) -> Result<(), RelayOfferStoreError> {
    let dir = offers_dir(home);
    fs::create_dir_all(&dir).map_err(|source| RelayOfferStoreError::Io {
        path: dir.clone(),
        source,
    })?;
    let path = offer_path(home, &stored.connection_id);
    let bytes = serde_json::to_vec_pretty(stored).map_err(|source| RelayOfferStoreError::Json {
        path: path.clone(),
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
    let mut file = options
        .open(&path)
        .map_err(|source| RelayOfferStoreError::Io {
            path: path.clone(),
            source,
        })?;
    std::io::Write::write_all(&mut file, &bytes_with_newline)
        .map_err(|source| RelayOfferStoreError::Io { path, source })
}

fn parse_offer(path: &Path, raw: &str) -> Result<StoredRelayOffer, RelayOfferStoreError> {
    let stored: StoredRelayOffer =
        serde_json::from_str(raw).map_err(|source| RelayOfferStoreError::Json {
            path: path.to_path_buf(),
            source,
        })?;
    if stored.v != OFFER_VERSION {
        return Err(invalid("unsupported relay offer version"));
    }
    if stored.connection_id.is_empty() || stored.nonce.is_empty() || stored.expires_at.is_empty() {
        return Err(invalid("relay offer missing required fields"));
    }
    Ok(stored)
}

fn parse_expires_at(value: &str) -> Result<OffsetDateTime, RelayOfferStoreError> {
    OffsetDateTime::parse(value, &Rfc3339).map_err(|source| RelayOfferStoreError::Invalid {
        message: source.to_string(),
    })
}

fn offers_dir(home: &Path) -> PathBuf {
    home.join(OFFERS_DIR_NAME)
}

fn offer_path(home: &Path, connection_id: &str) -> PathBuf {
    offers_dir(home).join(format!("{connection_id}.json"))
}

fn invalid(message: &str) -> RelayOfferStoreError {
    RelayOfferStoreError::Invalid {
        message: message.to_owned(),
    }
}
