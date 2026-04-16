//! Persisted global settings for the session browser.

use crate::{Error, LocalStore, Result};
use rusqlite::{OptionalExtension, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

const MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS: u64 = 1;
const MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS: u64 = 365;

/// Persisted global settings for Conduit's session browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    /// Default session lookback window in days for `sessions/grouped`.
    pub session_groups_updated_within_days: Option<u64>,
}

impl LocalStore {
    /// Reads persisted global settings.
    ///
    /// # Errors
    ///
    /// Returns an error when settings cannot be read or are invalid.
    pub fn global_settings(&self) -> Result<GlobalSettings> {
        let row = self
            .connection
            .query_row(
                "
                SELECT session_groups_updated_within_days
                FROM global_settings
                WHERE id = 1
                ",
                [],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()?
            .ok_or(Error::Invariant {
                message: "global settings row is missing",
            })?;
        Ok(GlobalSettings {
            session_groups_updated_within_days: read_days_value(
                "global settings value is invalid",
                row,
            )?,
        })
    }

    /// Updates persisted global settings.
    ///
    /// # Errors
    ///
    /// Returns an error when the supplied value is invalid or cannot be persisted.
    pub fn update_global_settings(
        &mut self,
        session_groups_updated_within_days: Option<u64>,
    ) -> Result<GlobalSettings> {
        let normalized =
            normalize_session_groups_updated_within_days(session_groups_updated_within_days)?;
        let persisted = normalized.map(i64::try_from).transpose().map_err(|error| {
            let _ = error;
            Error::Invariant {
                message: "global settings value overflows sqlite integer",
            }
        })?;
        self.connection.execute(
            "
            UPDATE global_settings
            SET session_groups_updated_within_days = ?2
            WHERE id = ?1
            ",
            params![1_i64, persisted],
        )?;
        self.global_settings()
    }
}

fn normalize_session_groups_updated_within_days(value: Option<u64>) -> Result<Option<u64>> {
    let Some(value) = value else {
        return Ok(None);
    };
    if (MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS..=MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS)
        .contains(&value)
    {
        return Ok(Some(value));
    }
    Err(Error::InvalidParameter {
        command: "settings/update",
        parameter: "sessionGroupsUpdatedWithinDays",
        message: "value must be between 1 and 365 or null",
    })
}

fn read_days_value(invariant_message: &'static str, value: Option<i64>) -> Result<Option<u64>> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = u64::try_from(value).map_err(|error| {
        let _ = error;
        Error::Invariant {
            message: invariant_message,
        }
    })?;
    if (MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS..=MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS)
        .contains(&value)
    {
        return Ok(Some(value));
    }
    Err(Error::Invariant {
        message: invariant_message,
    })
}
