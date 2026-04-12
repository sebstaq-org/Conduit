//! Session index read-model primitives.

use crate::{Error, LocalStore, OpenSessionKey, Result};
use acp_discovery::ProviderId;
use rusqlite::{OptionalExtension, Transaction, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One indexed ACP session for Conduit's session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexEntry {
    /// Provider that owns the ACP session.
    pub provider: ProviderId,
    /// Provider-issued ACP session id.
    pub session_id: String,
    /// Absolute cwd associated with the session.
    pub cwd: String,
    /// Provider-reported display title.
    pub title: Option<String>,
    /// Provider-reported last activity timestamp.
    pub updated_at: Option<String>,
}

/// Current indexed sessions plus index metadata.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionIndexSnapshot {
    /// Index revision. Increments when indexed session rows change.
    pub revision: i64,
    /// Last completed provider refresh timestamp for any indexed provider.
    pub refreshed_at: Option<String>,
    /// Indexed session rows.
    pub entries: Vec<SessionIndexEntry>,
}

impl SessionIndexEntry {
    pub(crate) fn sort_key(&self) -> (&str, &str, &str) {
        (self.provider.as_str(), &self.cwd, &self.session_id)
    }
}

impl LocalStore {
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
