//! Project cwd suggestions for the session browser.

use crate::{LocalStore, Result, project_id_for_cwd};
use acp_discovery::ProviderId;
use rusqlite::{Transaction, params};
use serde::{Deserialize, Serialize};

/// One addable cwd suggestion for the session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSuggestion {
    /// Stable render identity for the suggestion.
    pub suggestion_id: String,
    /// Absolute normalized cwd represented by this suggestion.
    pub cwd: String,
}

impl LocalStore {
    /// Lists addable project cwd suggestions.
    ///
    /// # Errors
    ///
    /// Returns an error when persisted suggestions cannot be read.
    pub fn project_suggestions(
        &self,
        query: Option<&str>,
        limit: usize,
    ) -> Result<Vec<ProjectSuggestion>> {
        let pattern = query.map(|value| format!("%{}%", value.to_lowercase()));
        let limit = i64::try_from(limit).unwrap_or(i64::MAX);
        let mut stmt = self.connection.prepare(
            "
            SELECT DISTINCT suggestion_id, cwd
            FROM project_suggestions
            WHERE NOT EXISTS (
                SELECT 1 FROM projects WHERE projects.cwd = project_suggestions.cwd
            )
            AND (?1 IS NULL OR lower(cwd) LIKE ?1)
            ORDER BY cwd
            LIMIT ?2
            ",
        )?;
        let rows = stmt.query_map(params![pattern, limit], |row| {
            Ok(ProjectSuggestion {
                suggestion_id: row.get(0)?,
                cwd: row.get(1)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(crate::Error::from)
    }

    /// Replaces cwd suggestions observed for one provider.
    ///
    /// # Errors
    ///
    /// Returns an error when suggestion rows cannot be written.
    pub fn replace_project_suggestions_provider(
        &mut self,
        provider: ProviderId,
        cwds: &[String],
    ) -> Result<()> {
        let tx = self.connection.transaction()?;
        tx.execute(
            "
            INSERT INTO project_suggestion_sources (
                provider,
                refreshed_at
            ) VALUES (?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT(provider) DO UPDATE SET
                refreshed_at = excluded.refreshed_at
            ",
            params![provider.as_str()],
        )?;
        tx.execute(
            "DELETE FROM project_suggestions WHERE provider = ?1",
            params![provider.as_str()],
        )?;
        insert_project_suggestions(&tx, provider, cwds)?;
        tx.commit()?;
        Ok(())
    }
}

fn insert_project_suggestions(
    tx: &Transaction<'_>,
    provider: ProviderId,
    cwds: &[String],
) -> Result<()> {
    for cwd in cwds {
        tx.execute(
            "
            INSERT INTO project_suggestions (
                provider,
                cwd,
                suggestion_id
            ) VALUES (?1, ?2, ?3)
            ON CONFLICT(provider, cwd) DO UPDATE SET
                suggestion_id = excluded.suggestion_id
            ",
            params![provider.as_str(), cwd, project_id_for_cwd(cwd)],
        )?;
    }
    Ok(())
}
