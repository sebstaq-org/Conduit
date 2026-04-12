//! SQLite helpers for stored session timelines.

use std::num::TryFromIntError;

use rusqlite::{OptionalExtension, Transaction, params};

use crate::ids::HISTORY_CURSOR_PREFIX;
use crate::{Error, Result, TranscriptItem};

struct ParsedCursor {
    open_session_id: String,
    revision: i64,
    end: usize,
}

pub(crate) fn next_revision(tx: &Transaction<'_>, open_session_id: &str) -> Result<i64> {
    let current = tx
        .query_row(
            "SELECT revision FROM open_sessions WHERE open_session_id = ?1",
            params![open_session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    Ok(current.unwrap_or(0) + 1)
}

pub(crate) fn insert_items(
    tx: &Transaction<'_>,
    open_session_id: &str,
    items: &[TranscriptItem],
) -> Result<()> {
    insert_items_at(tx, open_session_id, 0, items)
}

pub(crate) fn insert_items_at(
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

pub(crate) fn cursor_end(open_session_id: &str, revision: i64, cursor: &str) -> Result<usize> {
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

pub(crate) fn i64_from_usize(value: usize) -> Result<i64> {
    i64::try_from(value).map_err(int_error)
}

pub(crate) fn usize_from_i64(value: i64) -> Result<usize> {
    usize::try_from(value).map_err(int_error)
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

fn int_error(_error: TryFromIntError) -> Error {
    Error::Invariant {
        message: "integer value is too large for local store",
    }
}
