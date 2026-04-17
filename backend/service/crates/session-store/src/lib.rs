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
use ids::{history_cursor, open_session_id_for};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use serde_json::Value;
use session_projection::{project_items, prompt_turn_items};
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use thiserror::Error;
use timeline_storage::{
    cursor_end, i64_from_usize, insert_items, insert_items_at, next_revision, replace_turn_items,
    usize_from_i64,
};

mod history_limit;
mod ids;
mod open_session_state;
mod project_suggestions;
mod projects;
mod schema;
mod session_index;
mod settings;
mod timeline_storage;

pub use project_suggestions::ProjectSuggestion;
pub use projects::{ProjectRow, project_id_for_cwd};
use schema::{BOOTSTRAP_SCHEMA, MIGRATE_SCHEMA_5_TO_6, SCHEMA_VERSION};
pub use session_index::{SessionIndexEntry, SessionIndexSnapshot};
pub use session_projection::{MessageRole, TranscriptItem, TranscriptItemStatus};
pub use settings::GlobalSettings;

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
    pub(crate) connection: Connection,
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
    /// Items written by this mutation.
    pub items: Vec<TranscriptItem>,
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

/// Result of starting one prompt turn.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptTurnMutation {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
    /// New timeline revision after the mutation.
    pub revision: i64,
    /// Stable id for all items in this prompt turn.
    pub turn_id: String,
    /// Items written by this mutation.
    pub items: Vec<TranscriptItem>,
}

/// Input for replacing the materialized items for one in-flight prompt turn.
#[derive(Debug, Clone, Copy)]
pub struct PromptTurnReplace<'a> {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: &'a str,
    /// Prompt turn id allocated by [`LocalStore::begin_prompt_turn`].
    pub turn_id: &'a str,
    /// User prompt ACP content blocks.
    pub prompt: &'a [Value],
    /// ACP updates observed so far during the prompt turn.
    pub updates: &'a [TranscriptUpdateSnapshot],
    /// Current transcript status for agent-authored prompt items.
    pub status: TranscriptItemStatus,
    /// ACP stop reason returned by the provider, when known.
    pub stop_reason: Option<&'a str>,
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
        tracing::debug!(
            event_name = "session_store.open_session",
            source = "session-store",
            provider = %key.provider.as_str(),
            session_id = %key.session_id,
            cwd = %key.cwd,
            updates = updates.len(),
            limit = limit.value()
        );
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
        tracing::debug!(
            event_name = "session_store.append_prompt_turn_updates",
            source = "session-store",
            open_session_id = append.open_session_id,
            prompt_blocks = append.prompt.len(),
            updates = append.updates.len(),
            stop_reason = ?append.stop_reason
        );
        let existing = self.session_revision("session/prompt", append.open_session_id)?;
        let revision = existing + 1;
        let turn_id = format!("turn-{revision}");
        let items = prompt_turn_items(
            &turn_id,
            append.prompt,
            append.updates,
            append.status,
            append.stop_reason,
        );
        self.append_items(append.open_session_id, revision, &items)?;
        Ok(TimelineMutation {
            open_session_id: append.open_session_id.to_owned(),
            revision,
            items,
        })
    }

    /// Starts one prompt turn in an opened session timeline.
    ///
    /// # Errors
    ///
    /// Returns an error when the open session id is unknown or persistence
    /// fails.
    pub fn begin_prompt_turn(
        &mut self,
        open_session_id: &str,
        prompt: &[Value],
    ) -> Result<PromptTurnMutation> {
        let existing = self.session_revision("session/prompt", open_session_id)?;
        let revision = existing + 1;
        let turn_id = format!("turn-{revision}");
        let items = prompt_turn_items(&turn_id, prompt, &[], TranscriptItemStatus::Streaming, None);
        self.append_items(open_session_id, revision, &items)?;
        Ok(PromptTurnMutation {
            open_session_id: open_session_id.to_owned(),
            revision,
            turn_id,
            items,
        })
    }

    /// Replaces the materialized items for one in-flight prompt turn.
    ///
    /// # Errors
    ///
    /// Returns an error when the open session id is unknown or persistence
    /// fails.
    pub fn replace_prompt_turn_updates(
        &mut self,
        replace: PromptTurnReplace<'_>,
    ) -> Result<TimelineMutation> {
        let existing = self.session_revision("session/prompt", replace.open_session_id)?;
        let revision = existing + 1;
        let items = prompt_turn_items(
            replace.turn_id,
            replace.prompt,
            replace.updates,
            replace.status,
            replace.stop_reason,
        );
        let tx = self.connection.transaction()?;
        replace_turn_items(&tx, replace.open_session_id, replace.turn_id, &items)?;
        tx.execute(
            "UPDATE open_sessions SET revision = ?2 WHERE open_session_id = ?1",
            params![replace.open_session_id, revision],
        )?;
        tx.commit()?;
        Ok(TimelineMutation {
            open_session_id: replace.open_session_id.to_owned(),
            revision,
            items,
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
                self.connection.execute_batch(BOOTSTRAP_SCHEMA)?;
                Ok(())
            }
            5 => {
                self.connection.execute_batch(MIGRATE_SCHEMA_5_TO_6)?;
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
