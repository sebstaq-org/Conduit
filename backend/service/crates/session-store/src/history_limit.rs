//! Session history limit validation.

use crate::{Error, HistoryLimit, Result};

const DEFAULT_HISTORY_LIMIT: usize = 40;
const MAX_HISTORY_LIMIT: usize = 100;

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

    pub(crate) fn value(self) -> usize {
        self.value
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
