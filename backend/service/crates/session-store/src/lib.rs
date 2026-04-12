//! SQLite-backed local application store for Conduit read models.

#![forbid(unsafe_code)]
#![deny(
    missing_docs,
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::invalid_codeblock_attributes,
    rustdoc::invalid_rust_codeblocks,
    rustdoc::missing_crate_level_docs,
    rustdoc::private_intra_doc_links
)]

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use ids::{HISTORY_CURSOR_PREFIX, history_cursor, open_session_id_for};
use rusqlite::{Connection, OptionalExtension, Transaction, params};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::num::TryFromIntError;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use thiserror::Error;
use transcript::{project_items, project_prompt_turn_items};

mod ids;
mod session_index;
mod transcript;

pub use session_index::{SessionIndexEntry, SessionIndexSnapshot};
pub use transcript::{MessageRole, TranscriptItem, TranscriptItemStatus};

const SCHEMA_VERSION: i64 = 2;
const DEFAULT_HISTORY_LIMIT: usize = 40;
const MAX_HISTORY_LIMIT: usize = 100;

/// Result type for local store operations.
pub type Result<T> = std::result::Result<T, Error>;

/// Errors produced by the local store.
#[derive(Debug, Error)]
pub enum Error {
    /// Filesystem setup for the local store failed.
    #[error("failed to prepare local store path {path}")]
    PreparePath {
        /// Path being prepared.
        path: PathBuf,
        /// Underlying filesystem error.
        #[source]
        source: std::io::Error,
    },
    /// SQLite returned an error.
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
    /// JSON serialization for stored read-model payloads failed.
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    /// The store schema version is not supported by this binary.
    #[error("unsupported local store schema version {version}")]
    UnsupportedSchemaVersion {
        /// The unsupported schema version in the database.
        version: i64,
    },
    /// A command parameter cannot be accepted by the local store.
    #[error("{command} parameter {parameter} is invalid: {message}")]
    InvalidParameter {
        /// Command being served.
        command: &'static str,
        /// Invalid parameter name.
        parameter: &'static str,
        /// Human-readable reason.
        message: &'static str,
    },
    /// Stored data violated an internal local-store invariant.
    #[error("local store invariant failed: {message}")]
    Invariant {
        /// Human-readable invariant detail.
        message: &'static str,
    },
}

/// Key that identifies one loaded session history read model.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OpenSessionKey {
    /// Provider that owns the ACP session.
    pub provider: ProviderId,
    /// Provider-issued ACP session id.
    pub session_id: String,
    /// Absolute cwd used for `session/load`.
    pub cwd: String,
}

/// SQLite-backed local application store.
#[derive(Debug)]
pub struct LocalStore {
    connection: Connection,
}

/// One transcript history window returned to UI consumers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionHistoryWindow {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
    /// Current timeline revision for this opened session.
    pub revision: i64,
    /// Window of transcript items in display order.
    pub items: Vec<TranscriptItem>,
    /// Cursor for the next older page, when one exists.
    pub next_cursor: Option<String>,
}

/// Result of mutating a session timeline.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimelineMutation {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
    /// New timeline revision after the mutation.
    pub revision: i64,
}

/// Input for appending one completed prompt turn.
#[derive(Debug, Clone, Copy)]
pub struct PromptTurnAppend<'a> {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: &'a str,
    /// User prompt ACP content blocks.
    pub prompt: &'a [Value],
    /// ACP updates observed during the prompt turn.
    pub updates: &'a [TranscriptUpdateSnapshot],
    /// Terminal transcript status for agent-authored prompt items.
    pub status: TranscriptItemStatus,
    /// ACP stop reason returned by the provider, when known.
    pub stop_reason: Option<&'a str>,
}

struct ParsedCursor {
    open_session_id: String,
    revision: i64,
    end: usize,
}

struct WindowScope<'a> {
    command: &'static str,
    open_session_id: &'a str,
    revision: i64,
}

/// Validated limit for session history windows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HistoryLimit {
    value: usize,
}

impl LocalStore {
    /// Opens a local store at an explicit database path.
    ///
    /// # Errors
    ///
    /// Returns an error when the parent directory cannot be created, SQLite
    /// cannot open the file, or the schema version is unsupported.
    pub fn open_path(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        prepare_parent(path)?;
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", true)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let store = Self { connection };
        store.bootstrap()?;
        Ok(store)
    }

    /// Replaces the stored read-model for one loaded ACP session.
    ///
    /// # Errors
    ///
    /// Returns an error when the update cannot be persisted or windowed.
    pub fn open_session(
        &mut self,
        key: OpenSessionKey,
        updates: &[TranscriptUpdateSnapshot],
        limit: HistoryLimit,
    ) -> Result<SessionHistoryWindow> {
        let open_session_id = open_session_id_for(&key);
        let items = project_items(updates);
        let revision = self.replace_session_items(&open_session_id, &key, &items)?;
        self.window_at_revision(
            WindowScope {
                command: "session/open",
                open_session_id: &open_session_id,
                revision,
            },
            None,
            limit,
        )
    }

    /// Returns the already materialized history for an opened session key.
    ///
    /// # Errors
    ///
    /// Returns an error when the stored history cannot be read.
    pub fn cached_session(
        &self,
        key: &OpenSessionKey,
        limit: HistoryLimit,
    ) -> Result<Option<SessionHistoryWindow>> {
        let open_session_id = open_session_id_for(key);
        let Some(revision) = self.session_revision_optional(&open_session_id)? else {
            return Ok(None);
        };
        self.window_at_revision(
            WindowScope {
                command: "session/open",
                open_session_id: &open_session_id,
                revision,
            },
            None,
            limit,
        )
        .map(Some)
    }

    /// Returns one older history window for an opened session.
    ///
    /// # Errors
    ///
    /// Returns an error when the session, cursor, or limit is invalid.
    pub fn history_window(
        &self,
        open_session_id: &str,
        cursor: Option<String>,
        limit: HistoryLimit,
    ) -> Result<SessionHistoryWindow> {
        let revision = self.session_revision("session/history", open_session_id)?;
        self.window_at_revision(
            WindowScope {
                command: "session/history",
                open_session_id,
                revision,
            },
            cursor.as_deref(),
            limit,
        )
    }

    /// Appends one prompt turn to an opened session timeline.
    ///
    /// # Errors
    ///
    /// Returns an error when the open session id is unknown or persistence
    /// fails.
    pub fn append_prompt_turn_updates(
        &mut self,
        append: PromptTurnAppend<'_>,
    ) -> Result<TimelineMutation> {
        let existing = self.session_revision("session/prompt", append.open_session_id)?;
        let revision = existing + 1;
        let turn_id = format!("turn-{revision}");
        let mut items = vec![TranscriptItem::Message {
            id: format!("{turn_id}-user"),
            turn_id: Some(turn_id.clone()),
            status: Some(TranscriptItemStatus::Complete),
            stop_reason: None,
            role: MessageRole::User,
            content: append.prompt.to_owned(),
        }];
        let prompt_update_items =
            project_prompt_turn_items(&turn_id, append.updates, append.status, append.stop_reason);
        let has_agent_message = prompt_update_items.iter().any(|item| {
            matches!(
                item,
                TranscriptItem::Message {
                    role: MessageRole::Agent,
                    ..
                }
            )
        });
        items.extend(prompt_update_items);
        if !has_agent_message && append.status != TranscriptItemStatus::Complete {
            items.push(TranscriptItem::Message {
                id: format!("{turn_id}-terminal"),
                turn_id: Some(turn_id),
                status: Some(append.status),
                stop_reason: append.stop_reason.map(ToOwned::to_owned),
                role: MessageRole::Agent,
                content: Vec::new(),
            });
        }
        self.append_items(append.open_session_id, revision, &items)?;
        Ok(TimelineMutation {
            open_session_id: append.open_session_id.to_owned(),
            revision,
        })
    }

    /// Returns the provider that owns an open session id.
    ///
    /// # Errors
    ///
    /// Returns an error when stored provider data cannot be parsed.
    pub fn provider_for(&self, open_session_id: &str) -> Result<Option<ProviderId>> {
        let provider = self
            .connection
            .query_row(
                "SELECT provider FROM open_sessions WHERE open_session_id = ?1",
                params![open_session_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        provider
            .map(|value| {
                ProviderId::from_str(&value).map_err(|message| Error::Invariant { message })
            })
            .transpose()
    }

    /// Returns the local store identity for an opened session.
    ///
    /// # Errors
    ///
    /// Returns an error when stored provider data cannot be parsed.
    pub fn open_session_key(
        &self,
        command: &'static str,
        open_session_id: &str,
    ) -> Result<OpenSessionKey> {
        let key = self
            .connection
            .query_row(
                "SELECT provider, session_id, cwd FROM open_sessions WHERE open_session_id = ?1",
                params![open_session_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()?
            .ok_or(Error::InvalidParameter {
                command,
                parameter: "openSessionId",
                message: "unknown open session",
            })?;
        let provider =
            ProviderId::from_str(&key.0).map_err(|message| Error::Invariant { message })?;
        Ok(OpenSessionKey {
            provider,
            session_id: key.1,
            cwd: key.2,
        })
    }

    /// Returns indexed sessions for the requested providers.
    ///
    /// # Errors
    ///
    /// Returns an error when persisted index data cannot be read.
    pub fn session_index(&self, providers: &[ProviderId]) -> Result<SessionIndexSnapshot> {
        let mut entries = Vec::new();
        for provider in providers {
            entries.extend(self.session_index_entries_for(*provider)?);
        }
        entries.sort_by(|left, right| left.sort_key().cmp(&right.sort_key()));
        Ok(SessionIndexSnapshot {
            revision: self.session_index_revision()?,
            refreshed_at: self.session_index_refreshed_at()?,
            entries,
        })
    }

    /// Replaces the indexed session rows for one provider.
    ///
    /// # Errors
    ///
    /// Returns an error when the index cannot be updated.
    pub fn replace_session_index_provider(
        &mut self,
        provider: ProviderId,
        entries: &[SessionIndexEntry],
    ) -> Result<Option<i64>> {
        let mut entries = entries.to_vec();
        entries.sort_by(|left, right| left.sort_key().cmp(&right.sort_key()));
        let current = self.session_index_entries_for(provider)?;
        let changed = current != entries;
        let tx = self.connection.transaction()?;
        tx.execute(
            "
            INSERT INTO session_index_sources (
                provider,
                refreshed_at
            ) VALUES (?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT(provider) DO UPDATE SET
                refreshed_at = excluded.refreshed_at
            ",
            params![provider.as_str()],
        )?;
        if changed {
            tx.execute("UPDATE session_index_meta SET revision = revision + 1", [])?;
        }
        tx.execute(
            "DELETE FROM session_index_entries WHERE provider = ?1",
            params![provider.as_str()],
        )?;
        insert_session_index_entries(&tx, &entries)?;
        let revision = tx.query_row(
            "SELECT revision FROM session_index_meta WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        tx.commit()?;
        Ok(changed.then_some(revision))
    }

    /// Applies an ACP `session_info_update` to the session index.
    ///
    /// # Errors
    ///
    /// Returns an error when the index cannot be updated.
    pub fn apply_session_info_update(
        &mut self,
        key: &OpenSessionKey,
        update: &Value,
    ) -> Result<Option<i64>> {
        if update.get("sessionUpdate").and_then(Value::as_str) != Some("session_info_update") {
            return Ok(None);
        }
        let title = nullable_string_field(update, "title")?;
        let updated_at = nullable_string_field(update, "updatedAt")?;
        let current = self.session_index_entry(key)?;
        let entry = SessionIndexEntry {
            provider: key.provider,
            session_id: key.session_id.clone(),
            cwd: key.cwd.clone(),
            title: title.unwrap_or_else(|| current.as_ref().and_then(|value| value.title.clone())),
            updated_at: updated_at
                .unwrap_or_else(|| current.as_ref().and_then(|value| value.updated_at.clone())),
        };
        if current.as_ref() == Some(&entry) {
            return Ok(None);
        }
        let tx = self.connection.transaction()?;
        tx.execute("UPDATE session_index_meta SET revision = revision + 1", [])?;
        tx.execute(
            "
            INSERT INTO session_index_entries (
                provider,
                session_id,
                cwd,
                title,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(provider, session_id, cwd) DO UPDATE SET
                title = excluded.title,
                updated_at = excluded.updated_at
            ",
            params![
                key.provider.as_str(),
                &key.session_id,
                &key.cwd,
                &entry.title,
                &entry.updated_at
            ],
        )?;
        let revision = tx.query_row(
            "SELECT revision FROM session_index_meta WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        tx.commit()?;
        Ok(Some(revision))
    }

    fn bootstrap(&self) -> Result<()> {
        let version: i64 = self
            .connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))?;
        match version {
            0 => {
                self.connection.execute_batch(
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
                        FOREIGN KEY(open_session_id)
                            REFERENCES open_sessions(open_session_id)
                            ON DELETE CASCADE
                    );
                    CREATE TABLE session_index_meta (
                        id INTEGER PRIMARY KEY CHECK(id = 1),
                        revision INTEGER NOT NULL
                    );
                    INSERT INTO session_index_meta (id, revision) VALUES (1, 0);
                    CREATE TABLE session_index_sources (
                        provider TEXT PRIMARY KEY,
                        refreshed_at TEXT NOT NULL
                    );
                    CREATE TABLE session_index_entries (
                        provider TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        cwd TEXT NOT NULL,
                        title TEXT,
                        updated_at TEXT,
                        PRIMARY KEY(provider, session_id, cwd)
                    );
                    PRAGMA user_version = 2;
                    ",
                )?;
                Ok(())
            }
            SCHEMA_VERSION => Ok(()),
            _ => Err(Error::UnsupportedSchemaVersion { version }),
        }
    }

    fn replace_session_items(
        &mut self,
        open_session_id: &str,
        key: &OpenSessionKey,
        items: &[TranscriptItem],
    ) -> Result<i64> {
        let tx = self.connection.transaction()?;
        let revision = next_revision(&tx, open_session_id)?;
        tx.execute(
            "
            INSERT INTO open_sessions (
                open_session_id,
                provider,
                session_id,
                cwd,
                revision
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(open_session_id) DO UPDATE SET
                provider = excluded.provider,
                session_id = excluded.session_id,
                cwd = excluded.cwd,
                revision = excluded.revision
            ",
            params![
                open_session_id,
                key.provider.as_str(),
                &key.session_id,
                &key.cwd,
                revision
            ],
        )?;
        tx.execute(
            "DELETE FROM transcript_items WHERE open_session_id = ?1",
            params![open_session_id],
        )?;
        insert_items(&tx, open_session_id, items)?;
        tx.commit()?;
        Ok(revision)
    }

    fn append_items(
        &mut self,
        open_session_id: &str,
        revision: i64,
        items: &[TranscriptItem],
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        tx.execute(
            "UPDATE open_sessions SET revision = ?2 WHERE open_session_id = ?1",
            params![open_session_id, revision],
        )?;
        let start = tx.query_row(
            "SELECT COUNT(*) FROM transcript_items WHERE open_session_id = ?1",
            params![open_session_id],
            |row| row.get::<_, i64>(0),
        )?;
        insert_items_at(&tx, open_session_id, usize_from_i64(start)?, items)?;
        tx.commit()?;
        Ok(())
    }

    fn window_at_revision(
        &self,
        scope: WindowScope<'_>,
        cursor: Option<&str>,
        limit: HistoryLimit,
    ) -> Result<SessionHistoryWindow> {
        let item_count = self.item_count(scope.command, scope.open_session_id)?;
        let end = match cursor {
            Some(cursor) => cursor_end(scope.open_session_id, scope.revision, cursor)?,
            None => item_count,
        };
        if end > item_count {
            return Err(Error::InvalidParameter {
                command: "session/history",
                parameter: "cursor",
                message: "cursor is outside the loaded transcript",
            });
        }
        let start = end.saturating_sub(limit.value());
        let items = self.items_between(scope.open_session_id, start, end)?;
        let next_cursor = if start == 0 {
            None
        } else {
            Some(history_cursor(scope.open_session_id, scope.revision, start))
        };
        Ok(SessionHistoryWindow {
            open_session_id: scope.open_session_id.to_owned(),
            revision: scope.revision,
            items,
            next_cursor,
        })
    }

    fn session_revision(&self, command: &'static str, open_session_id: &str) -> Result<i64> {
        self.session_revision_optional(open_session_id)?
            .ok_or(Error::InvalidParameter {
                command,
                parameter: "openSessionId",
                message: "unknown open session",
            })
    }

    fn session_revision_optional(&self, open_session_id: &str) -> Result<Option<i64>> {
        self.connection
            .query_row(
                "SELECT revision FROM open_sessions WHERE open_session_id = ?1",
                params![open_session_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(Error::from)
    }

    fn item_count(&self, command: &'static str, open_session_id: &str) -> Result<usize> {
        let count = self
            .connection
            .query_row(
                "SELECT COUNT(*) FROM transcript_items WHERE open_session_id = ?1",
                params![open_session_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .ok_or(Error::InvalidParameter {
                command,
                parameter: "openSessionId",
                message: "unknown open session",
            })?;
        usize::try_from(count).map_err(|_error| Error::Invariant {
            message: "stored item count is invalid",
        })
    }

    fn items_between(
        &self,
        open_session_id: &str,
        start: usize,
        end: usize,
    ) -> Result<Vec<TranscriptItem>> {
        let limit = end.saturating_sub(start);
        let start = i64_from_usize(start)?;
        let limit = i64_from_usize(limit)?;
        let mut stmt = self.connection.prepare(
            "
            SELECT item_json
            FROM transcript_items
            WHERE open_session_id = ?1
            ORDER BY item_ordinal
            LIMIT ?2 OFFSET ?3
            ",
        )?;
        let rows = stmt.query_map(params![open_session_id, limit, start], |row| {
            row.get::<_, String>(0)
        })?;
        let item_json = rows.collect::<std::result::Result<Vec<_>, _>>()?;
        item_json
            .into_iter()
            .map(|value| serde_json::from_str(&value).map_err(Error::from))
            .collect()
    }

    fn session_index_entries_for(&self, provider: ProviderId) -> Result<Vec<SessionIndexEntry>> {
        let mut stmt = self.connection.prepare(
            "
            SELECT session_id, cwd, title, updated_at
            FROM session_index_entries
            WHERE provider = ?1
            ORDER BY provider, cwd, session_id
            ",
        )?;
        let rows = stmt.query_map(params![provider.as_str()], |row| {
            Ok(SessionIndexEntry {
                provider,
                session_id: row.get(0)?,
                cwd: row.get(1)?,
                title: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Error::from)
    }

    fn session_index_entry(&self, key: &OpenSessionKey) -> Result<Option<SessionIndexEntry>> {
        self.connection
            .query_row(
                "
                SELECT title, updated_at
                FROM session_index_entries
                WHERE provider = ?1 AND session_id = ?2 AND cwd = ?3
                ",
                params![key.provider.as_str(), &key.session_id, &key.cwd],
                |row| {
                    Ok(SessionIndexEntry {
                        provider: key.provider,
                        session_id: key.session_id.clone(),
                        cwd: key.cwd.clone(),
                        title: row.get(0)?,
                        updated_at: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(Error::from)
    }

    fn session_index_revision(&self) -> Result<i64> {
        self.connection
            .query_row(
                "SELECT revision FROM session_index_meta WHERE id = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(Error::from)
    }

    fn session_index_refreshed_at(&self) -> Result<Option<String>> {
        self.connection
            .query_row(
                "SELECT MAX(refreshed_at) FROM session_index_sources",
                [],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(Error::from)
    }
}

impl HistoryLimit {
    /// Validates a caller-supplied optional history window limit.
    ///
    /// # Errors
    ///
    /// Returns an error when the limit is zero or exceeds the supported maximum.
    pub fn new(command: &'static str, limit: Option<u64>) -> Result<Self> {
        let value = normalize_limit(command, limit)?;
        Ok(Self { value })
    }

    fn value(self) -> usize {
        self.value
    }
}

fn prepare_parent(path: &Path) -> Result<()> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    fs::create_dir_all(parent).map_err(|source| Error::PreparePath {
        path: parent.to_path_buf(),
        source,
    })
}

fn next_revision(tx: &Transaction<'_>, open_session_id: &str) -> Result<i64> {
    let current = tx
        .query_row(
            "SELECT revision FROM open_sessions WHERE open_session_id = ?1",
            params![open_session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    Ok(current.unwrap_or(0) + 1)
}

fn insert_items(
    tx: &Transaction<'_>,
    open_session_id: &str,
    items: &[TranscriptItem],
) -> Result<()> {
    insert_items_at(tx, open_session_id, 0, items)
}

fn insert_items_at(
    tx: &Transaction<'_>,
    open_session_id: &str,
    start_ordinal: usize,
    items: &[TranscriptItem],
) -> Result<()> {
    for (ordinal, item) in items.iter().enumerate() {
        tx.execute(
            "
            INSERT INTO transcript_items (
                open_session_id,
                item_ordinal,
                item_json
            ) VALUES (?1, ?2, ?3)
            ",
            params![
                open_session_id,
                i64_from_usize(start_ordinal + ordinal)?,
                serde_json::to_string(item)?
            ],
        )?;
    }
    Ok(())
}

fn insert_session_index_entries(tx: &Transaction<'_>, entries: &[SessionIndexEntry]) -> Result<()> {
    for entry in entries {
        tx.execute(
            "
            INSERT INTO session_index_entries (
                provider,
                session_id,
                cwd,
                title,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![
                entry.provider.as_str(),
                &entry.session_id,
                &entry.cwd,
                &entry.title,
                &entry.updated_at
            ],
        )?;
    }
    Ok(())
}

fn nullable_string_field(value: &Value, field: &'static str) -> Result<Option<Option<String>>> {
    match value.get(field) {
        None => Ok(None),
        Some(Value::Null) => Ok(Some(None)),
        Some(Value::String(value)) => Ok(Some(Some(value.clone()))),
        Some(_) => Err(Error::InvalidParameter {
            command: "session/prompt",
            parameter: field,
            message: "session info field must be a string or null",
        }),
    }
}

fn normalize_limit(command: &'static str, limit: Option<u64>) -> Result<usize> {
    let limit = limit.unwrap_or(DEFAULT_HISTORY_LIMIT as u64);
    if limit == 0 || limit > MAX_HISTORY_LIMIT as u64 {
        return Err(Error::InvalidParameter {
            command,
            parameter: "limit",
            message: "limit must be between 1 and 100",
        });
    }
    usize::try_from(limit).map_err(|_error| Error::InvalidParameter {
        command,
        parameter: "limit",
        message: "limit must fit the platform pointer width",
    })
}

fn cursor_end(open_session_id: &str, revision: i64, cursor: &str) -> Result<usize> {
    let parsed = parse_cursor(cursor)?;
    if parsed.open_session_id != open_session_id {
        return Err(Error::InvalidParameter {
            command: "session/history",
            parameter: "cursor",
            message: "cursor belongs to another open session",
        });
    }
    if parsed.revision != revision {
        return Err(Error::InvalidParameter {
            command: "session/history",
            parameter: "cursor",
            message: "cursor belongs to an older loaded transcript",
        });
    }
    Ok(parsed.end)
}

fn parse_cursor(cursor: &str) -> Result<ParsedCursor> {
    let mut parts = cursor.split(':');
    let Some(prefix) = parts.next() else {
        return invalid_cursor();
    };
    let Some(open_session_id) = parts.next() else {
        return invalid_cursor();
    };
    let Some(revision) = parts.next() else {
        return invalid_cursor();
    };
    let Some(end) = parts.next() else {
        return invalid_cursor();
    };
    if prefix != HISTORY_CURSOR_PREFIX || parts.next().is_some() {
        return invalid_cursor();
    }
    let revision = revision.parse::<i64>().map_err(|_error| cursor_error())?;
    let end = end.parse::<usize>().map_err(|_error| cursor_error())?;
    Ok(ParsedCursor {
        open_session_id: open_session_id.to_owned(),
        revision,
        end,
    })
}

fn invalid_cursor<T>() -> Result<T> {
    Err(cursor_error())
}

fn cursor_error() -> Error {
    Error::InvalidParameter {
        command: "session/history",
        parameter: "cursor",
        message: "cursor is invalid",
    }
}

fn i64_from_usize(value: usize) -> Result<i64> {
    i64::try_from(value).map_err(int_error)
}

fn usize_from_i64(value: i64) -> Result<usize> {
    usize::try_from(value).map_err(int_error)
}

fn int_error(_error: TryFromIntError) -> Error {
    Error::Invariant {
        message: "integer value is too large for local store",
    }
}
