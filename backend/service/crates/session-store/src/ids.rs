//! Session-store id and cursor helpers.

use super::OpenSessionKey;
use sha2::{Digest, Sha256};

pub(crate) const HISTORY_CURSOR_PREFIX: &str = "history-cursor-v1";
const OPEN_SESSION_PREFIX: &str = "open-session-";

pub(crate) fn history_cursor(open_session_id: &str, revision: i64, end: usize) -> String {
    format!("{HISTORY_CURSOR_PREFIX}:{open_session_id}:{revision}:{end}")
}

pub(crate) fn open_session_id_for(key: &OpenSessionKey) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.provider.as_str().as_bytes());
    hasher.update([0]);
    hasher.update(key.session_id.as_bytes());
    hasher.update([0]);
    hasher.update(key.cwd.as_bytes());
    format!("{OPEN_SESSION_PREFIX}{}", hex_encode(&hasher.finalize()))
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(hex_digit(byte >> 4));
        output.push(hex_digit(byte & 0x0f));
    }
    output
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => char::from(b'0' + value),
        _ => char::from(b'a' + value - 10),
    }
}
