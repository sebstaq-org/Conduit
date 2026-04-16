//! Integration tests for the SQLite local store.

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use serde as _;
use serde_json::{Value, json};
use session_store::{
    HistoryLimit, LocalStore, OpenSessionKey, PromptTurnReplace, SessionIndexEntry,
    TranscriptItemStatus, project_id_for_cwd,
};
use sha2 as _;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror as _;
use tracing as _;

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
fn legacy_schema_version_five_migrates_open_session_states() -> TestResult<()> {
    let path = test_db_path()?;
    create_legacy_schema_version_five(&path)?;

    let store = LocalStore::open_path(&path)?;
    drop(store);
    let connection = rusqlite::Connection::open(&path)?;
    let migrated_version: i64 =
        connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let migrated_table_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'open_session_states'",
        [],
        |row| row.get(0),
    )?;

    ensure_eq(&migrated_version, &6, "migrated schema version")?;
    ensure_eq(&migrated_table_count, &1, "open_session_states table count")?;
    fs::remove_file(path)?;
    Ok(())
}

fn create_legacy_schema_version_five(path: &PathBuf) -> TestResult<()> {
    let connection = rusqlite::Connection::open(path)?;
    connection.execute_batch(
        "
        CREATE TABLE open_sessions (
            open_session_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            session_id TEXT NOT NULL,
            cwd TEXT NOT NULL,
            revision INTEGER NOT NULL,
            UNIQUE(provider, session_id, cwd)
        );
        CREATE TABLE transcript_items (
            open_session_id TEXT NOT NULL,
            item_ordinal INTEGER NOT NULL,
            item_json TEXT NOT NULL,
            PRIMARY KEY(open_session_id, item_ordinal),
            FOREIGN KEY(open_session_id) REFERENCES open_sessions(open_session_id) ON DELETE CASCADE
        );
        CREATE TABLE session_index_meta (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL);
        INSERT INTO session_index_meta (id, revision) VALUES (1, 0);
        CREATE TABLE session_index_sources (provider TEXT PRIMARY KEY, refreshed_at TEXT NOT NULL);
        CREATE TABLE session_index_entries (
            provider TEXT NOT NULL,
            session_id TEXT NOT NULL,
            cwd TEXT NOT NULL,
            title TEXT,
            updated_at TEXT,
            PRIMARY KEY(provider, session_id, cwd)
        );
        CREATE TABLE projects (
            project_id TEXT PRIMARY KEY,
            cwd TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE TABLE project_suggestion_sources (provider TEXT PRIMARY KEY, refreshed_at TEXT NOT NULL);
        CREATE TABLE project_suggestions (
            provider TEXT NOT NULL,
            cwd TEXT NOT NULL,
            suggestion_id TEXT NOT NULL,
            PRIMARY KEY(provider, cwd)
        );
        CREATE TABLE global_settings (id INTEGER PRIMARY KEY CHECK(id = 1), session_groups_updated_within_days INTEGER);
        INSERT INTO global_settings (id, session_groups_updated_within_days) VALUES (1, 5);
        ",
    )?;
    connection.pragma_update(None, "user_version", 5)?;
    Ok(())
}

#[test]
fn global_settings_default_and_update() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let default_settings = store.global_settings()?;

    ensure_eq(
        &default_settings.session_groups_updated_within_days,
        &Some(5),
        "default lookback",
    )?;

    let all_history = store.update_global_settings(None)?;
    ensure_eq(
        &all_history.session_groups_updated_within_days,
        &None,
        "all-history lookback",
    )?;

    let custom = store.update_global_settings(Some(17))?;
    ensure_eq(
        &custom.session_groups_updated_within_days,
        &Some(17),
        "custom lookback",
    )?;
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn global_settings_rejects_out_of_range_values() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let response = store.update_global_settings(Some(0));
    if response.is_ok() {
        return Err("out-of-range lookback unexpectedly succeeded".into());
    }
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn open_session_state_roundtrip_reads_latest_state() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");
    store.open_session(key.clone(), &updates("loaded"), limit(4)?)?;

    let first_state = json!({
        "sessionId": "session-1",
        "configOptions": []
    });
    store.set_open_session_state(&key, &first_state)?;
    ensure_eq(
        &store.open_session_state(&key)?,
        &Some(first_state.clone()),
        "first open session state",
    )?;

    let updated_state = json!({
        "sessionId": "session-1",
        "configOptions": [{ "id": "mode", "value": "turbo" }]
    });
    store.set_open_session_state(&key, &updated_state)?;
    ensure_eq(
        &store.open_session_state(&key)?,
        &Some(updated_state),
        "updated open session state",
    )?;

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
fn projects_add_list_and_remove_by_project_id() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;

    let project = store.add_project("/repo")?;
    let repeated = store.add_project("/repo")?;
    let projects = store.projects()?;

    ensure_eq(&project, &repeated, "idempotent project add")?;
    ensure_eq(
        &project.project_id,
        &project_id_for_cwd("/repo"),
        "project id",
    )?;
    ensure_eq(&project.display_name, &"repo".to_owned(), "display name")?;
    ensure_eq(&projects, &vec![project.clone()], "project list")?;

    store.remove_project(&project.project_id)?;
    ensure_eq(&store.projects()?.len(), &0, "removed project count")?;
    let repeated_remove = store.remove_project(&project.project_id);
    if repeated_remove.is_ok() {
        return Err("repeated project remove unexpectedly succeeded".into());
    }
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn project_display_name_is_mutable_without_changing_cwd() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let project = store.add_project("/workspace/conduit")?;

    let renamed = store.update_project_display_name(&project.project_id, " Conduit ")?;

    ensure_eq(
        &renamed.project_id,
        &project.project_id,
        "project id remains stable",
    )?;
    ensure_eq(&renamed.cwd, &project.cwd, "cwd remains stable")?;
    ensure_eq(
        &renamed.display_name,
        &"Conduit".to_owned(),
        "display name is trimmed",
    )?;
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn project_display_name_rejects_empty_update() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let project = store.add_project("/repo")?;

    let response = store.update_project_display_name(&project.project_id, " ");

    if response.is_ok() {
        return Err("empty displayName unexpectedly succeeded".into());
    }
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn project_suggestions_replace_query_limit_and_exclude_projects() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;

    store.replace_project_suggestions_provider(
        ProviderId::Codex,
        &["/repo".to_owned(), "/other".to_owned()],
    )?;
    store.replace_project_suggestions_provider(
        ProviderId::Claude,
        &["/repo".to_owned(), "/zeta".to_owned()],
    )?;
    store.add_project("/repo")?;

    let all = store.project_suggestions(None, 10)?;
    let filtered = store.project_suggestions(Some("ot"), 10)?;
    let limited = store.project_suggestions(None, 1)?;

    ensure_eq(
        &all.iter().map(|row| row.cwd.as_str()).collect::<Vec<_>>(),
        &vec!["/other", "/zeta"],
        "deduped addable suggestions",
    )?;
    ensure_eq(
        &all[0].suggestion_id,
        &project_id_for_cwd("/other"),
        "suggestion id",
    )?;
    ensure_eq(
        &filtered
            .iter()
            .map(|row| row.cwd.as_str())
            .collect::<Vec<_>>(),
        &vec!["/other"],
        "query suggestions",
    )?;
    ensure_eq(&limited.len(), &1, "limited suggestions")?;
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

#[test]
fn prompt_turn_replace_preserves_surrounding_timeline_items() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");
    let opened = store.open_session(key, &updates("loaded agent"), limit(10)?)?;
    let first_turn = store.begin_prompt_turn(
        &opened.open_session_id,
        &[json!({ "type": "text", "text": "first prompt" })],
    )?;
    let second_turn = store.begin_prompt_turn(
        &opened.open_session_id,
        &[json!({ "type": "text", "text": "second prompt" })],
    )?;

    let mutation = store.replace_prompt_turn_updates(PromptTurnReplace {
        open_session_id: &opened.open_session_id,
        turn_id: &first_turn.turn_id,
        prompt: &[json!({ "type": "text", "text": "first prompt" })],
        updates: &[
            transcript_update(10, "agent_message_chunk", "first streamed"),
            transcript_update(11, "agent_message_chunk", " answer"),
        ],
        status: TranscriptItemStatus::Streaming,
        stop_reason: None,
    })?;
    let latest = store.history_window(&opened.open_session_id, None, limit(10)?)?;
    let texts = history_texts(&latest.items)?;

    ensure_eq(&mutation.items.len(), &2, "changed turn item count")?;
    ensure_eq(
        &texts,
        &vec![
            "old user".to_owned(),
            "old agent".to_owned(),
            "new user".to_owned(),
            "loaded agent".to_owned(),
            "first prompt".to_owned(),
            "first streamed answer".to_owned(),
            "second prompt".to_owned(),
        ],
        "timeline text order",
    )?;
    ensure_eq(
        &latest.items.last(),
        &second_turn.items.last(),
        "following turn preserved",
    )?;
    fs::remove_file(path)?;
    Ok(())
}

#[test]
fn prompt_turn_replace_rejects_missing_turn_without_append_fallback() -> TestResult<()> {
    let path = test_db_path()?;
    let mut store = LocalStore::open_path(&path)?;
    let key = key("session-1");
    let opened = store.open_session(key, &updates("loaded agent"), limit(10)?)?;

    let response = store.replace_prompt_turn_updates(PromptTurnReplace {
        open_session_id: &opened.open_session_id,
        turn_id: "missing-turn",
        prompt: &[json!({ "type": "text", "text": "prompt" })],
        updates: &[transcript_update(10, "agent_message_chunk", "agent")],
        status: TranscriptItemStatus::Streaming,
        stop_reason: None,
    });
    let latest = store.history_window(&opened.open_session_id, None, limit(10)?)?;

    if response.is_ok() {
        return Err("missing prompt turn unexpectedly appended".into());
    }
    ensure_eq(
        &latest.items.len(),
        &4,
        "timeline item count after rejection",
    )?;
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

fn history_texts(items: &[session_store::TranscriptItem]) -> TestResult<Vec<String>> {
    let mut texts = Vec::new();
    for item in items {
        if let session_store::TranscriptItem::Message { content, .. } = item {
            texts.push(
                content
                    .iter()
                    .filter_map(|block| block.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join(""),
            );
        }
    }
    Ok(texts)
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
