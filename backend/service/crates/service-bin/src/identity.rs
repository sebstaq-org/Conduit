//! Persistent daemon identity and pairing offer support.

use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use thiserror::Error;
use x25519_dalek::{PublicKey, StaticSecret};

const IDENTITY_FILE_NAME: &str = "daemon-identity.json";
const KEYPAIR_FILE_NAME: &str = "daemon-keypair.json";
const IDENTITY_VERSION: u8 = 1;
const KEYPAIR_VERSION: u8 = 1;
const KEYPAIR_ALGORITHM: &str = "x25519";

/// The stable daemon identity exposed to trusted clients.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct DaemonIdentity {
    /// Stable daemon identifier scoped to the product home.
    pub(crate) server_id: String,
    /// Public key encoded with standard base64.
    pub(crate) daemon_public_key_b64: String,
}

/// A relay-only pairing offer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectionOfferV1 {
    /// Pairing offer schema version.
    pub(crate) v: u8,
    /// Stable daemon identifier.
    pub(crate) server_id: String,
    /// Daemon public key encoded with standard base64.
    pub(crate) daemon_public_key_b64: String,
    /// Relay routing details.
    pub(crate) relay: RelayOffer,
}

/// Relay endpoint carried by a pairing offer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct RelayOffer {
    /// Public relay endpoint as host:port.
    pub(crate) endpoint: String,
}

/// JSON response returned by CLI and HTTP pairing surfaces.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct PairingResponse {
    /// Pairing URL carrying the offer in the fragment.
    pub(crate) url: String,
    /// Decoded offer payload.
    pub(crate) offer: ConnectionOfferV1,
}

/// JSON response returned by daemon status surfaces.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DaemonStatusResponse {
    /// Stable daemon identifier.
    pub(crate) server_id: String,
    /// Whether a relay endpoint is configured for pairing.
    pub(crate) pairing_configured: bool,
    /// Configured relay endpoint, when available.
    pub(crate) relay_endpoint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredIdentity {
    v: u8,
    server_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredKeyPair {
    v: u8,
    algorithm: String,
    public_key_b64: String,
    secret_key_b64: String,
}

/// Errors raised by daemon identity persistence.
#[derive(Debug, Error)]
pub(crate) enum DaemonIdentityError {
    /// Identity file I/O failed.
    #[error("daemon identity io failed for {path}: {source}")]
    Io {
        /// Path involved in the failed operation.
        path: PathBuf,
        /// Underlying I/O error.
        source: std::io::Error,
    },
    /// Identity file JSON was invalid.
    #[error("daemon identity file {path} is invalid: {message}")]
    InvalidFile {
        /// Invalid file path.
        path: PathBuf,
        /// Human-readable validation details.
        message: String,
    },
    /// Base64 decoding failed.
    #[error("daemon identity file {path} has invalid base64 in {field}")]
    InvalidBase64 {
        /// Invalid file path.
        path: PathBuf,
        /// Invalid field name.
        field: &'static str,
    },
}

/// Loads or creates the persistent daemon identity under `home`.
///
/// # Errors
///
/// Returns an error when persisted identity files are unreadable or invalid.
pub(crate) fn load_or_create_daemon_identity(
    home: &Path,
) -> Result<DaemonIdentity, DaemonIdentityError> {
    fs::create_dir_all(home).map_err(|source| DaemonIdentityError::Io {
        path: home.to_path_buf(),
        source,
    })?;
    let identity = load_or_create_identity(home)?;
    let keypair = load_or_create_keypair(home)?;
    Ok(DaemonIdentity {
        server_id: identity.server_id,
        daemon_public_key_b64: keypair.public_key_b64,
    })
}

/// Builds one pairing response for the configured relay endpoint.
///
/// # Errors
///
/// Returns an error when daemon identity cannot be loaded or created.
pub(crate) fn pairing_response(
    home: &Path,
    relay_endpoint: &str,
    app_base_url: &str,
) -> Result<PairingResponse, DaemonIdentityError> {
    let identity = load_or_create_daemon_identity(home)?;
    let offer = ConnectionOfferV1 {
        v: IDENTITY_VERSION,
        server_id: identity.server_id,
        daemon_public_key_b64: identity.daemon_public_key_b64,
        relay: RelayOffer {
            endpoint: relay_endpoint.to_owned(),
        },
    };
    let encoded = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&offer).map_err(|source| {
        DaemonIdentityError::InvalidFile {
            path: home.join(IDENTITY_FILE_NAME),
            message: source.to_string(),
        }
    })?);
    Ok(PairingResponse {
        url: format!("{}/#offer={encoded}", app_base_url.trim_end_matches('/')),
        offer,
    })
}

/// Builds one daemon status response.
///
/// # Errors
///
/// Returns an error when daemon identity cannot be loaded or created.
pub(crate) fn daemon_status_response(
    home: &Path,
    relay_endpoint: Option<String>,
) -> Result<DaemonStatusResponse, DaemonIdentityError> {
    let identity = load_or_create_daemon_identity(home)?;
    Ok(DaemonStatusResponse {
        server_id: identity.server_id,
        pairing_configured: relay_endpoint.is_some(),
        relay_endpoint,
    })
}

fn load_or_create_identity(home: &Path) -> Result<StoredIdentity, DaemonIdentityError> {
    let path = home.join(IDENTITY_FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(raw) => parse_identity(&path, &raw),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let identity = StoredIdentity {
                v: IDENTITY_VERSION,
                server_id: generate_server_id(),
            };
            write_secret_file(&path, &identity)?;
            Ok(identity)
        }
        Err(source) => Err(DaemonIdentityError::Io { path, source }),
    }
}

fn parse_identity(path: &Path, raw: &str) -> Result<StoredIdentity, DaemonIdentityError> {
    let identity: StoredIdentity =
        serde_json::from_str(raw).map_err(|source| DaemonIdentityError::InvalidFile {
            path: path.to_path_buf(),
            message: source.to_string(),
        })?;
    if identity.v != IDENTITY_VERSION {
        return Err(invalid_file(path, "unsupported identity version"));
    }
    if !identity.server_id.starts_with("srv_") || identity.server_id.len() <= 4 {
        return Err(invalid_file(path, "invalid serverId"));
    }
    Ok(identity)
}

fn load_or_create_keypair(home: &Path) -> Result<StoredKeyPair, DaemonIdentityError> {
    let path = home.join(KEYPAIR_FILE_NAME);
    match fs::read_to_string(&path) {
        Ok(raw) => parse_keypair(&path, &raw),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let keypair = generate_keypair();
            write_secret_file(&path, &keypair)?;
            Ok(keypair)
        }
        Err(source) => Err(DaemonIdentityError::Io { path, source }),
    }
}

fn parse_keypair(path: &Path, raw: &str) -> Result<StoredKeyPair, DaemonIdentityError> {
    let keypair: StoredKeyPair =
        serde_json::from_str(raw).map_err(|source| DaemonIdentityError::InvalidFile {
            path: path.to_path_buf(),
            message: source.to_string(),
        })?;
    if keypair.v != KEYPAIR_VERSION {
        return Err(invalid_file(path, "unsupported keypair version"));
    }
    if keypair.algorithm != KEYPAIR_ALGORITHM {
        return Err(invalid_file(path, "unsupported keypair algorithm"));
    }
    let public = decode_fixed_key(path, "publicKeyB64", &keypair.public_key_b64)?;
    let secret = decode_fixed_key(path, "secretKeyB64", &keypair.secret_key_b64)?;
    let expected_public = PublicKey::from(&StaticSecret::from(secret));
    if public != expected_public.to_bytes() {
        return Err(invalid_file(path, "public key does not match secret key"));
    }
    Ok(keypair)
}

fn decode_fixed_key(
    path: &Path,
    field: &'static str,
    value: &str,
) -> Result<[u8; 32], DaemonIdentityError> {
    let bytes = STANDARD
        .decode(value)
        .map_err(|_source| DaemonIdentityError::InvalidBase64 {
            path: path.to_path_buf(),
            field,
        })?;
    bytes
        .try_into()
        .map_err(|_source: Vec<u8>| invalid_file(path, "key length must be 32 bytes"))
}

fn generate_keypair() -> StoredKeyPair {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    StoredKeyPair {
        v: KEYPAIR_VERSION,
        algorithm: KEYPAIR_ALGORITHM.to_owned(),
        public_key_b64: STANDARD.encode(public.as_bytes()),
        secret_key_b64: STANDARD.encode(secret.to_bytes()),
    }
}

fn generate_server_id() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    format!("srv_{}", URL_SAFE_NO_PAD.encode(bytes))
}

fn write_secret_file<T: Serialize>(path: &Path, value: &T) -> Result<(), DaemonIdentityError> {
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|source| DaemonIdentityError::InvalidFile {
            path: path.to_path_buf(),
            message: source.to_string(),
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
        .open(path)
        .map_err(|source| DaemonIdentityError::Io {
            path: path.to_path_buf(),
            source,
        })?;
    std::io::Write::write_all(&mut file, &bytes_with_newline).map_err(|source| {
        DaemonIdentityError::Io {
            path: path.to_path_buf(),
            source,
        }
    })
}

fn invalid_file(path: &Path, message: &str) -> DaemonIdentityError {
    DaemonIdentityError::InvalidFile {
        path: path.to_path_buf(),
        message: message.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        KEYPAIR_FILE_NAME, daemon_status_response, load_or_create_daemon_identity, pairing_response,
    };
    use std::error::Error;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[test]
    fn daemon_identity_is_stable_in_same_home() -> TestResult<()> {
        let home = test_home("stable")?;
        let first = load_or_create_daemon_identity(&home)?;
        let second = load_or_create_daemon_identity(&home)?;
        cleanup(home);

        if first == second {
            return Ok(());
        }
        Err("daemon identity changed for same home".into())
    }

    #[test]
    fn daemon_identity_changes_for_new_home() -> TestResult<()> {
        let first_home = test_home("first")?;
        let second_home = test_home("second")?;
        let first = load_or_create_daemon_identity(&first_home)?;
        let second = load_or_create_daemon_identity(&second_home)?;
        cleanup(first_home);
        cleanup(second_home);

        if first.server_id != second.server_id
            && first.daemon_public_key_b64 != second.daemon_public_key_b64
        {
            return Ok(());
        }
        Err("daemon identity did not change for new home".into())
    }

    #[test]
    fn invalid_keypair_file_fails_fast() -> TestResult<()> {
        let home = test_home("invalid-keypair")?;
        fs::create_dir_all(&home)?;
        fs::write(home.join(KEYPAIR_FILE_NAME), "{ not json")?;
        let result = load_or_create_daemon_identity(&home);
        cleanup(home);

        if result.is_err() {
            return Ok(());
        }
        Err("invalid keypair file was silently regenerated".into())
    }

    #[test]
    fn pairing_response_contains_only_public_offer_fields() -> TestResult<()> {
        let home = test_home("pairing")?;
        let response = pairing_response(&home, "relay.example.test:443", "https://app.test")?;
        let text = serde_json::to_string(&response)?;
        cleanup(home);

        if response.offer.v != 1 {
            return Err("unexpected offer version".into());
        }
        if response.offer.relay.endpoint != "relay.example.test:443" {
            return Err("unexpected relay endpoint".into());
        }
        for forbidden in ["secret", "CONDUIT_HOME", "local-store", "daemon-keypair"] {
            if text.contains(forbidden) {
                return Err(format!("pairing response leaked {forbidden}").into());
            }
        }
        Ok(())
    }

    #[test]
    fn daemon_status_reports_pairing_configuration() -> TestResult<()> {
        let home = test_home("status")?;
        let status = daemon_status_response(&home, Some("relay.example.test:443".to_owned()))?;
        cleanup(home);

        if status.pairing_configured
            && status.relay_endpoint.as_deref() == Some("relay.example.test:443")
        {
            return Ok(());
        }
        Err("daemon status did not report pairing configuration".into())
    }

    #[cfg(unix)]
    #[test]
    fn keypair_file_is_owner_only_on_unix() -> TestResult<()> {
        use std::os::unix::fs::PermissionsExt;

        let home = test_home("permissions")?;
        let _identity = load_or_create_daemon_identity(&home)?;
        let metadata = fs::metadata(home.join(KEYPAIR_FILE_NAME))?;
        let mode = metadata.permissions().mode() & 0o777;
        cleanup(home);

        if mode == 0o600 {
            return Ok(());
        }
        Err(format!("unexpected keypair mode {mode:o}").into())
    }

    fn test_home(label: &str) -> TestResult<std::path::PathBuf> {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        Ok(std::env::temp_dir().join(format!("conduit-daemon-identity-{label}-{nanos}")))
    }

    fn cleanup(path: std::path::PathBuf) {
        let _ignored = fs::remove_dir_all(path);
    }
}
