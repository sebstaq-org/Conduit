use crate::ids::open_session_id_for;
use crate::{Error, LocalStore, OpenSessionKey, Result};
use rusqlite::{OptionalExtension, params};
use serde_json::Value;

impl LocalStore {
    /// Returns persisted open-session provider state for one opened session.
    ///
    /// # Errors
    ///
    /// Returns an error when persisted state JSON is invalid.
    pub fn open_session_state(&self, key: &OpenSessionKey) -> Result<Option<Value>> {
        let open_session_id = open_session_id_for(key);
        let serialized = self
            .connection
            .query_row(
                "SELECT state_json FROM open_session_states WHERE open_session_id = ?1",
                params![open_session_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        serialized
            .map(|value| serde_json::from_str(&value).map_err(Error::from))
            .transpose()
    }

    /// Persists open-session provider state for one opened session.
    ///
    /// # Errors
    ///
    /// Returns an error when the open session key is unknown or state cannot be
    /// persisted.
    pub fn set_open_session_state(&mut self, key: &OpenSessionKey, state: &Value) -> Result<()> {
        let open_session_id = open_session_id_for(key);
        if self.session_revision_optional(&open_session_id)?.is_none() {
            return Err(Error::InvalidParameter {
                command: "session/open",
                parameter: "sessionId",
                message: "unknown session key",
            });
        }
        let serialized = serde_json::to_string(state)?;
        self.connection.execute(
            "
            INSERT INTO open_session_states (
                open_session_id,
                state_json
            ) VALUES (?1, ?2)
            ON CONFLICT(open_session_id) DO UPDATE SET
                state_json = excluded.state_json
            ",
            params![open_session_id, serialized],
        )?;
        Ok(())
    }
}
