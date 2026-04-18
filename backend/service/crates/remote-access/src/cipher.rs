//! Relay E2EE frame support shared with the TypeScript relay transport.

use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use thiserror::Error;
use x25519_dalek::{PublicKey, StaticSecret};

const RELAY_CIPHER_VERSION: u8 = 1;
const KEY_LENGTH: usize = 32;
const SHARED_MATERIAL_LENGTH: usize = 64;
const NONCE_LENGTH: usize = 12;

/// E2EE key derivation context for one relay data socket.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayCipherContext {
    /// Public relay server route id.
    pub server_id: String,
    /// Public offer-bound relay connection route id.
    pub connection_id: String,
    /// Pairing offer nonce.
    pub offer_nonce: String,
}

/// Server-side relay cipher channel after accepting a client handshake.
pub struct RelayCipherChannel {
    context: RelayCipherContext,
    decrypt_key: Aes256Gcm,
    encrypt_key: Aes256Gcm,
    next_inbound_sequence: u64,
    next_outbound_sequence: u64,
}

/// Errors raised by relay E2EE frame handling.
#[derive(Debug, Error)]
pub enum RelayCipherError {
    /// JSON frame parsing failed.
    #[error("relay cipher json frame failed: {0}")]
    Json(#[from] serde_json::Error),
    /// Base64 decoding failed.
    #[error("relay cipher base64 field {field} is invalid")]
    InvalidBase64 {
        /// Invalid field name.
        field: &'static str,
    },
    /// A frame failed protocol validation.
    #[error("relay cipher frame is invalid: {message}")]
    InvalidFrame {
        /// Human-readable validation details.
        message: String,
    },
    /// Symmetric encryption or decryption failed.
    #[error("relay cipher cryptographic operation failed")]
    Crypto,
}

#[derive(Debug, Deserialize)]
struct RelayHandshakeFrame {
    v: u8,
    #[serde(rename = "type")]
    frame_type: String,
    #[serde(rename = "clientPublicKeyB64")]
    client_public_key_b64: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelayCipherFrame {
    v: u8,
    #[serde(rename = "type")]
    frame_type: String,
    sender: String,
    seq: u64,
    ciphertext_b64: String,
}

/// Accepts a client relay handshake using the daemon X25519 secret key.
///
/// # Errors
///
/// Returns an error when the handshake, key material, or key derivation fails.
pub fn accept_client_handshake(
    context: RelayCipherContext,
    daemon_secret_key_b64: &str,
    handshake_text: &str,
) -> Result<RelayCipherChannel, RelayCipherError> {
    let handshake: RelayHandshakeFrame = serde_json::from_str(handshake_text)?;
    if handshake.v != RELAY_CIPHER_VERSION || handshake.frame_type != "handshake" {
        return Err(invalid("handshake frame is invalid"));
    }
    let daemon_secret = decode_fixed_key("daemonSecretKeyB64", daemon_secret_key_b64)?;
    let client_public = decode_fixed_key("clientPublicKeyB64", &handshake.client_public_key_b64)?;
    let shared_secret =
        StaticSecret::from(daemon_secret).diffie_hellman(&PublicKey::from(client_public));
    RelayCipherChannel::create(context, shared_secret.as_bytes())
}

impl RelayCipherChannel {
    fn create(
        context: RelayCipherContext,
        shared_secret: &[u8; KEY_LENGTH],
    ) -> Result<Self, RelayCipherError> {
        let keys = derive_keys(shared_secret, &context)?;
        let decrypt_key = Aes256Gcm::new_from_slice(&keys[0..KEY_LENGTH])
            .map_err(|_source| RelayCipherError::Crypto)?;
        let encrypt_key = Aes256Gcm::new_from_slice(&keys[KEY_LENGTH..SHARED_MATERIAL_LENGTH])
            .map_err(|_source| RelayCipherError::Crypto)?;
        Ok(Self {
            context,
            decrypt_key,
            encrypt_key,
            next_inbound_sequence: 0,
            next_outbound_sequence: 0,
        })
    }

    /// Decrypts one client ciphertext frame into a UTF-8 consumer frame.
    ///
    /// # Errors
    ///
    /// Returns an error when the frame is invalid, out of order, or cannot be
    /// decrypted.
    pub fn decrypt_utf8(&mut self, frame_text: &str) -> Result<String, RelayCipherError> {
        let frame: RelayCipherFrame = serde_json::from_str(frame_text)?;
        validate_cipher_frame(&frame, "client", self.next_inbound_sequence)?;
        let ciphertext = decode_base64("ciphertextB64", &frame.ciphertext_b64)?;
        let plaintext = self
            .decrypt_key
            .decrypt(
                Nonce::from_slice(&nonce_for("client", frame.seq)),
                Payload {
                    msg: &ciphertext,
                    aad: &additional_data(&self.context, "client", frame.seq),
                },
            )
            .map_err(|_source| RelayCipherError::Crypto)?;
        self.next_inbound_sequence = self
            .next_inbound_sequence
            .checked_add(1)
            .ok_or_else(|| invalid("cipher frame sequence overflowed"))?;
        String::from_utf8(plaintext).map_err(|source| RelayCipherError::InvalidFrame {
            message: source.to_string(),
        })
    }

    /// Encrypts one UTF-8 consumer frame as a server ciphertext frame.
    ///
    /// # Errors
    ///
    /// Returns an error when encryption fails or the outbound sequence exceeds
    /// the supported range.
    pub fn encrypt_utf8(&mut self, plaintext: &str) -> Result<String, RelayCipherError> {
        let sequence = self.next_outbound_sequence;
        self.next_outbound_sequence = self
            .next_outbound_sequence
            .checked_add(1)
            .ok_or_else(|| invalid("cipher frame sequence overflowed"))?;
        let ciphertext = self
            .encrypt_key
            .encrypt(
                Nonce::from_slice(&nonce_for("server", sequence)),
                Payload {
                    msg: plaintext.as_bytes(),
                    aad: &additional_data(&self.context, "server", sequence),
                },
            )
            .map_err(|_source| RelayCipherError::Crypto)?;
        serde_json::to_string(&RelayCipherFrame {
            v: RELAY_CIPHER_VERSION,
            frame_type: "ciphertext".to_owned(),
            sender: "server".to_owned(),
            seq: sequence,
            ciphertext_b64: STANDARD.encode(ciphertext),
        })
        .map_err(RelayCipherError::Json)
    }
}

fn derive_keys(
    shared_secret: &[u8; KEY_LENGTH],
    context: &RelayCipherContext,
) -> Result<[u8; SHARED_MATERIAL_LENGTH], RelayCipherError> {
    let salt = format!(
        "conduit-relay:{}:{}:{}",
        context.server_id, context.connection_id, context.offer_nonce
    );
    let hkdf = Hkdf::<Sha256>::new(Some(salt.as_bytes()), shared_secret);
    let mut keys = [0_u8; SHARED_MATERIAL_LENGTH];
    hkdf.expand(b"conduit relay e2ee v1", &mut keys)
        .map_err(|_source| RelayCipherError::Crypto)?;
    Ok(keys)
}

fn validate_cipher_frame(
    frame: &RelayCipherFrame,
    expected_sender: &str,
    expected_sequence: u64,
) -> Result<(), RelayCipherError> {
    if frame.v != RELAY_CIPHER_VERSION || frame.frame_type != "ciphertext" {
        return Err(invalid("ciphertext frame is invalid"));
    }
    if frame.sender != expected_sender {
        return Err(invalid("ciphertext frame sender is invalid"));
    }
    if frame.seq != expected_sequence {
        return Err(invalid("ciphertext frame sequence is invalid"));
    }
    Ok(())
}

fn decode_fixed_key(
    field: &'static str,
    value: &str,
) -> Result<[u8; KEY_LENGTH], RelayCipherError> {
    let bytes = decode_base64(field, value)?;
    bytes
        .try_into()
        .map_err(|_source: Vec<u8>| invalid("key length must be 32 bytes"))
}

fn decode_base64(field: &'static str, value: &str) -> Result<Vec<u8>, RelayCipherError> {
    STANDARD
        .decode(value)
        .map_err(|_source| RelayCipherError::InvalidBase64 { field })
}

fn nonce_for(sender: &str, sequence: u64) -> [u8; NONCE_LENGTH] {
    let mut nonce = [0_u8; NONCE_LENGTH];
    nonce[0] = if sender == "client" { 1 } else { 2 };
    nonce[4..NONCE_LENGTH].copy_from_slice(&sequence.to_be_bytes());
    nonce
}

fn additional_data(context: &RelayCipherContext, sender: &str, sequence: u64) -> Vec<u8> {
    format!(
        "conduit-relay-frame:{}:{}:{}:{sender}:{sequence}",
        context.server_id, context.connection_id, context.offer_nonce
    )
    .into_bytes()
}

fn invalid(message: &str) -> RelayCipherError {
    RelayCipherError::InvalidFrame {
        message: message.to_owned(),
    }
}
