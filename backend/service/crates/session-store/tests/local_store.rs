//! Integration tests for the SQLite local store.

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use serde as _;
use serde_json::{Value, json};
use session_store::{HistoryLimit, LocalStore, OpenSessionKey, SessionIndexEntry};
use sha2 as _;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn open_session_persists_and_pages_retryable_history_windows() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");

    let opened = store.open_session(key.clone(), &updates("new"), limit(2)?)?;
    ensure_eq(&opened.items.len(), &2, "open window item count")?;
    let cursor = opened
        .next_cursor
        .clone()
        .ok_or("expected cursor for older history")?;

    let older = store.history_window(&opened.open_session_id, Some(cursor.clone()), limit(2)?)?;
    let retried = store.history_window(&opened.open_session_id, Some(cursor), limit(2)?)?;

    ensure_eq(&older, &retried, "retryable history window")?;
    ensure_eq(&older.next_cursor, &None, "older next cursor")?;
    let item_text = serde_json::to_value(&older.items)?
        .get(0)
        .and_then(|item| item.get("content"))
        .and_then(Value::as_array)
        .and_then(|content| content.first())
        .and_then(|content| content.get("text"))
        .and_then(Value::as_str)
        .ok_or("missing content text")?
        .to_owned();
    ensure_eq(&item_text, &"old user".to_owned(), "older item text")?;
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn repeated_open_replaces_items_and_invalidates_old_cursor() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");
    let first = store.open_session(key.clone(), &updates("first"), limit(1)?)?;
    let old_cursor = first.next_cursor.clone().ok_or("expected first cursor")?;
    let second = store.open_session(key, &updates("second"), limit(4)?)?;

    ensure_eq(
        &first.open_session_id,
        &second.open_session_id,
        "openSessionId",
    )?;
    let response = store.history_window(&second.open_session_id, Some(old_cursor), limit(1)?);
    if response.is_ok() {
        return Err("stale history cursor unexpectedly succeeded".into());
    }
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn unsupported_schema_version_fails_hard() -> TestResult<()> {
    let path = test_db_path()?;
    let connection = rusqlite::Connection::open(&path)?;
    connection.pragma_update(None, "user_version", 1)?;
    drop(connection);

    let response = LocalStore::open_path(&path);

    if response.is_ok() {
        return Err("unsupported schema version unexpectedly opened".into());
    }
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn session_index_replaces_provider_rows_and_tracks_revision() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let first_revision = store
        .replace_session_index_provider(
            ProviderId::Codex,
            &[index_entry("codex-1", "/repo", Some("Codex one"))],
        )?
        .ok_or("expected first index revision")?;
    let unchanged = store.replace_session_index_provider(
        ProviderId::Codex,
        &[index_entry("codex-1", "/repo", Some("Codex one"))],
    )?;

    ensure_eq(&first_revision, &1, "first index revision")?;
    ensure_eq(&unchanged, &None, "unchanged index replacement")?;
    let snapshot = store.session_index(&[ProviderId::Codex])?;
    ensure_eq(&snapshot.revision, &1, "snapshot revision")?;
    ensure_eq(&snapshot.entries.len(), &1, "index entry count")?;
    ensure_eq(
        &snapshot.entries[0].session_id,
        &"codex-1".to_owned(),
        "index session id",
    )?;
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn cached_session_returns_materialized_history_without_replacing_it() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");
    let opened = store.open_session(key.clone(), &updates("first"), limit(4)?)?;
    let cached = store
        .cached_session(&key, limit(4)?)?
        .ok_or("expected cached history")?;

    ensure_eq(&cached, &opened, "cached session history")?;
    fs::remove_file(path)?;
    Ok(())
}

fn ensure_eq<T>(actual: &T, expected: &T, label: &str) -> TestResult<()>
where
    T: std::fmt::Debug + PartialEq,
{
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected {label} {expected:?}, got {actual:?}").into())
}

fn limit(value: u64) -> TestResult<HistoryLimit> {
    Ok(HistoryLimit::new("test", Some(value))?)
}

fn key(session_id: &str) -> OpenSessionKey {
    OpenSessionKey {
        provider: ProviderId::Codex,
        session_id: session_id.to_owned(),
        cwd: "/repo".to_owned(),
    }
}

fn index_entry(session_id: &str, cwd: &str, title: Option<&str>) -> SessionIndexEntry {
    SessionIndexEntry {
        provider: ProviderId::Codex,
        session_id: session_id.to_owned(),
        cwd: cwd.to_owned(),
        title: title.map(ToOwned::to_owned),
        updated_at: Some("9999-01-01T00:00:00Z".to_owned()),
    }
}

fn updates(new_agent_text: &str) -> Vec<TranscriptUpdateSnapshot> {
    vec![
        transcript_update(0, "user_message_chunk", "old user"),
        transcript_update(1, "agent_message_chunk", "old agent"),
        transcript_update(2, "user_message_chunk", "new user"),
        transcript_update(3, "agent_message_chunk", new_agent_text),
    ]
}

fn transcript_update(index: usize, variant: &str, text: &str) -> TranscriptUpdateSnapshot {
    TranscriptUpdateSnapshot {
        index,
        variant: variant.to_owned(),
        update: json!({
            "sessionUpdate": variant,
            "content": {
                "type": "text",
                "text": text
            }
        }),
    }
}

fn test_db_path() -> TestResult<PathBuf> {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!(
        "conduit-session-store-{}-{nanos}.sqlite3",
        std::process::id()
    )))
}
