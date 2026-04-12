//! Persisted project rows for the session browser.

use crate::{LocalStore, Result};
use rusqlite::{OptionalExtension, params};
use serde::{Deserialize, Serialize};

/// One persisted cwd selected for Conduit's session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    /// Stable render and mutation identity for the project.
    pub project_id: String,
    /// Absolute normalized cwd represented by this project.
    pub cwd: String,
    /// User-facing project label.
    pub display_name: String,
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
            SELECT project_id, cwd, display_name
            FROM projects
            ORDER BY display_name, cwd
            ",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ProjectRow {
                project_id: row.get(0)?,
                cwd: row.get(1)?,
                display_name: row.get(2)?,
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
            display_name: display_name_for_cwd(cwd),
        };
        self.connection.execute(
            "
            INSERT INTO projects (project_id, cwd, display_name)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(project_id) DO NOTHING
            ",
            params![&project.project_id, &project.cwd, &project.display_name],
        )?;
        self.project("projects/add", &project.project_id)
    }

    /// Updates a persisted session browser project label.
    ///
    /// # Errors
    ///
    /// Returns an error when the display name is empty or the row cannot be updated.
    pub fn update_project_display_name(
        &mut self,
        project_id: &str,
        display_name: &str,
    ) -> Result<ProjectRow> {
        let display_name = normalized_display_name(display_name)?;
        self.connection.execute(
            "
            UPDATE projects
            SET display_name = ?2
            WHERE project_id = ?1
            ",
            params![project_id, display_name],
        )?;
        self.project("projects/update", project_id)
    }

    /// Removes a persisted session browser project.
    ///
    /// # Errors
    ///
    /// Returns an error when the project row cannot be deleted or does not exist.
    pub fn remove_project(&mut self, project_id: &str) -> Result<()> {
        let removed = self.connection.execute(
            "DELETE FROM projects WHERE project_id = ?1",
            params![project_id],
        )?;
        if removed == 0 {
            return Err(crate::Error::InvalidParameter {
                command: "projects/remove",
                parameter: "projectId",
                message: "unknown project",
            });
        }
        Ok(())
    }

    fn project(&self, command: &'static str, project_id: &str) -> Result<ProjectRow> {
        self.connection
            .query_row(
                "
                SELECT project_id, cwd, display_name
                FROM projects
                WHERE project_id = ?1
                ",
                params![project_id],
                |row| {
                    Ok(ProjectRow {
                        project_id: row.get(0)?,
                        cwd: row.get(1)?,
                        display_name: row.get(2)?,
                    })
                },
            )
            .optional()?
            .ok_or(crate::Error::InvalidParameter {
                command,
                parameter: "projectId",
                message: "unknown project",
            })
    }
}

/// Returns the deterministic project id for an absolute normalized cwd.
#[must_use]
pub fn project_id_for_cwd(cwd: &str) -> String {
    format!("cwd:{cwd}")
}

fn display_name_for_cwd(cwd: &str) -> String {
    cwd.rsplit('/')
        .find(|segment| !segment.is_empty())
        .map_or_else(|| "/".to_owned(), ToOwned::to_owned)
}

fn normalized_display_name(display_name: &str) -> Result<String> {
    let display_name = display_name.trim();
    if display_name.is_empty() {
        return Err(crate::Error::InvalidParameter {
            command: "projects/update",
            parameter: "displayName",
            message: "displayName cannot be empty",
        });
    }
    Ok(display_name.to_owned())
}
