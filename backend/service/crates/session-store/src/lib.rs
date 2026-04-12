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
use std::fs;
use std::num::TryFromIntError;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use thiserror::Error;
use transcript::{project_items, project_prompt_turn_items};

mod ids;
mod transcript;

pub use transcript::{MessageRole, TranscriptItem, TranscriptItemStatus};

const SCHEMA_VERSION: i64 = 1;
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
        open_session_id: &str,
        prompt: &str,
        updates: &[TranscriptUpdateSnapshot],
        status: TranscriptItemStatus,
    ) -> Result<TimelineMutation> {
        let existing = self.session_revision("session/prompt", open_session_id)?;
        let revision = existing + 1;
        let turn_id = format!("turn-{revision}");
        let mut items = vec![TranscriptItem::Message {
            id: format!("{turn_id}-user"),
            turn_id: Some(turn_id.clone()),
            status: Some(TranscriptItemStatus::Complete),
            role: MessageRole::User,
            text: prompt.to_owned(),
            source_variants: vec!["session_prompt".to_owned()],
        }];
        let prompt_update_items = project_prompt_turn_items(&turn_id, updates, status);
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
        if !has_agent_message && status != TranscriptItemStatus::Complete {
            items.push(TranscriptItem::Message {
                id: format!("{turn_id}-terminal"),
                turn_id: Some(turn_id),
                status: Some(status),
                role: MessageRole::Agent,
                text: String::new(),
                source_variants: vec![prompt_status_source_variant(status).to_owned()],
            });
        }
        self.append_items(open_session_id, revision, &items)?;
        Ok(TimelineMutation {
            open_session_id: open_session_id.to_owned(),
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
                    PRAGMA user_version = 1;
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
        self.connection
            .query_row(
                "SELECT revision FROM open_sessions WHERE open_session_id = ?1",
                params![open_session_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .ok_or(Error::InvalidParameter {
                command,
                parameter: "openSessionId",
                message: "unknown open session",
            })
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

fn prompt_status_source_variant(status: TranscriptItemStatus) -> &'static str {
    match status {
        TranscriptItemStatus::Complete => "session_prompt",
        TranscriptItemStatus::Streaming => "session_prompt_streaming",
        TranscriptItemStatus::Cancelled => "session_prompt_cancelled",
        TranscriptItemStatus::Failed => "session_prompt_failed",
    }
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
