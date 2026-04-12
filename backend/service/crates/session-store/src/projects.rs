//! Persisted project rows for the session browser.

use crate::{LocalStore, Result};
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// One persisted cwd selected for Conduit's session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    /// Stable render and mutation identity for the project.
    pub project_id: String,
    /// Absolute normalized cwd represented by this project.
    pub cwd: String,
}

impl LocalStore {
    /// Lists persisted session browser projects.
    ///
    /// # Errors
    ///
    /// Returns an error when persisted project rows cannot be read.
    pub fn projects(&self) -> Result<Vec<ProjectRow>> {
        let mut stmt = self.connection.prepare(
            "
            SELECT project_id, cwd
            FROM projects
            ORDER BY cwd
            ",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectRow {
                project_id: row.get(0)?,
                cwd: row.get(1)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(crate::Error::from)
    }

    /// Adds a persisted session browser project.
    ///
    /// # Errors
    ///
    /// Returns an error when the project row cannot be written.
    pub fn add_project(&mut self, cwd: &str) -> Result<ProjectRow> {
        let project = ProjectRow {
            project_id: project_id_for_cwd(cwd),
            cwd: cwd.to_owned(),
        };
        self.connection.execute(
            "
            INSERT INTO projects (project_id, cwd)
            VALUES (?1, ?2)
            ON CONFLICT(project_id) DO UPDATE SET
                cwd = excluded.cwd
            ",
            params![&project.project_id, &project.cwd],
        )?;
        Ok(project)
    }

    /// Removes a persisted session browser project.
    ///
    /// # Errors
    ///
    /// Returns an error when the project row cannot be deleted.
    pub fn remove_project(&mut self, project_id: &str) -> Result<()> {
        self.connection.execute(
            "DELETE FROM projects WHERE project_id = ?1",
            params![project_id],
        )?;
        Ok(())
    }
}

/// Returns the deterministic project id for an absolute normalized cwd.
#[must_use]
pub fn project_id_for_cwd(cwd: &str) -> String {
    format!("cwd:{cwd}")
}
