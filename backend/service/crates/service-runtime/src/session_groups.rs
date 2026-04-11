//! Conduit-owned session grouping read model.

use crate::{Result, RuntimeError};
use acp_discovery::ProviderId;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json, to_value};
use std::collections::HashMap;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_UPDATED_WITHIN_DAYS: u64 = 5;
const SECONDS_PER_DAY: u64 = 86_400;
const ALL_PROVIDERS: [ProviderId; 3] = [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex];

#[derive(Debug, Clone)]
pub(crate) struct SessionGroupsQuery {
    cwd_filters: Vec<String>,
    updated_since_epoch: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionGroupsParams {
    cwd_filters: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListedSession {
    session_id: String,
    cwd: String,
    title: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionRow {
    provider: ProviderId,
    session_id: String,
    title: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionRowWithCwd {
    cwd: String,
    row: SessionRow,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionGroup {
    group_id: String,
    cwd: String,
    sessions: Vec<SessionRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionGroupsView {
    groups: Vec<SessionGroup>,
}

impl SessionGroupsQuery {
    pub(crate) fn from_params(params: &Value) -> Result<Self> {
        if params.get("providers").is_some() {
            return Err(RuntimeError::InvalidParameter {
                command: "sessions/grouped",
                parameter: "providers",
                message: "provider scope is selected by command.provider",
            });
        }
        let updated_within_days = params.get("updatedWithinDays").cloned();
        let params: SessionGroupsParams =
            serde_json::from_value(params.clone()).map_err(invalid_params)?;
        Ok(Self {
            cwd_filters: params
                .cwd_filters
                .unwrap_or_default()
                .into_iter()
                .map(|cwd| normalize_cwd(&cwd))
                .collect(),
            updated_since_epoch: updated_since_epoch(updated_within_days)?,
        })
    }

    pub(crate) fn cwd_filters(&self) -> &[String] {
        &self.cwd_filters
    }

    fn accepts(&self, cwd: &str, session: &ListedSession) -> bool {
        (self.cwd_filters.is_empty() || self.cwd_filters.iter().any(|filter| filter == cwd))
            && self.accepts_updated_at(session.updated_at.as_deref())
    }

    fn accepts_updated_at(&self, updated_at: Option<&str>) -> bool {
        let Some(updated_since_epoch) = self.updated_since_epoch else {
            return true;
        };
        updated_at
            .and_then(parse_rfc3339_epoch)
            .is_none_or(|updated_epoch| updated_epoch >= updated_since_epoch)
    }
}

pub(crate) fn providers_from_target(target: &str) -> Result<Vec<ProviderId>> {
    if target == "all" {
        return Ok(ALL_PROVIDERS.to_vec());
    }
    ProviderId::from_str(target)
        .map(|provider| vec![provider])
        .map_err(|message| RuntimeError::UnknownProvider {
            provider: target.to_owned(),
            message,
        })
}

pub(crate) fn rows_from_session_list(
    provider: ProviderId,
    result: &Value,
    query: &SessionGroupsQuery,
) -> Result<Vec<SessionRowWithCwd>> {
    let sessions = result.get("sessions").cloned().unwrap_or_else(|| json!([]));
    let sessions: Vec<ListedSession> = serde_json::from_value(sessions).map_err(invalid_params)?;
    sessions
        .into_iter()
        .filter_map(|session| {
            let cwd = normalize_cwd(&session.cwd);
            if !query.accepts(&cwd, &session) {
                return None;
            }
            Some(Ok(SessionRowWithCwd {
                cwd,
                row: SessionRow {
                    provider,
                    session_id: session.session_id,
                    title: session.title,
                    updated_at: session.updated_at,
                },
            }))
        })
        .collect()
}

pub(crate) fn next_cursor(result: &Value) -> Result<Option<String>> {
    match result.get("nextCursor") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(cursor)) => Ok(Some(cursor.to_owned())),
        Some(_) => Err(RuntimeError::InvalidParameter {
            command: "sessions/grouped",
            parameter: "nextCursor",
            message: "provider returned a non-string cursor",
        }),
    }
}

pub(crate) fn grouped_view(rows: Vec<SessionRowWithCwd>) -> Result<Value> {
    let mut groups = HashMap::<String, Vec<SessionRow>>::new();
    for row in rows {
        groups.entry(row.cwd).or_default().push(row.row);
    }
    let mut groups = groups
        .into_iter()
        .map(|(cwd, mut sessions)| {
            sessions.sort_by(compare_rows);
            SessionGroup {
                group_id: group_id(&cwd),
                cwd,
                sessions,
            }
        })
        .collect::<Vec<_>>();
    groups.sort_by(compare_groups);
    to_value(SessionGroupsView { groups }).map_err(RuntimeError::from)
}

fn updated_since_epoch(updated_within_days: Option<Value>) -> Result<Option<u64>> {
    let updated_within_days = match updated_within_days {
        None => Some(DEFAULT_UPDATED_WITHIN_DAYS),
        Some(Value::Null) => None,
        Some(Value::Number(number)) => Some(number.as_u64().ok_or(
            RuntimeError::InvalidStringParameter {
                command: "sessions/grouped",
                parameter: "updatedWithinDays",
            },
        )?),
        Some(_) => {
            return Err(RuntimeError::InvalidStringParameter {
                command: "sessions/grouped",
                parameter: "updatedWithinDays",
            });
        }
    };
    let Some(updated_within_days) = updated_within_days else {
        return Ok(None);
    };
    let now_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs());
    Ok(Some(now_epoch.saturating_sub(
        updated_within_days.saturating_mul(SECONDS_PER_DAY),
    )))
}

fn compare_rows(left: &SessionRow, right: &SessionRow) -> std::cmp::Ordering {
    compare_optional_desc(&left.updated_at, &right.updated_at)
        .then_with(|| left.provider.as_str().cmp(right.provider.as_str()))
        .then_with(|| left.session_id.cmp(&right.session_id))
}

fn compare_groups(left: &SessionGroup, right: &SessionGroup) -> std::cmp::Ordering {
    compare_optional_desc(
        &group_latest_updated_at(left),
        &group_latest_updated_at(right),
    )
    .then_with(|| left.cwd.cmp(&right.cwd))
}

fn compare_optional_desc(left: &Option<String>, right: &Option<String>) -> std::cmp::Ordering {
    match (left, right) {
        (Some(left), Some(right)) => right.cmp(left),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    }
}

fn group_latest_updated_at(group: &SessionGroup) -> Option<String> {
    group
        .sessions
        .iter()
        .filter_map(|session| session.updated_at.clone())
        .max()
}

fn group_id(cwd: &str) -> String {
    format!("cwd:{cwd}")
}

pub(crate) fn normalize_cwd(cwd: &str) -> String {
    let absolute = cwd.starts_with('/');
    let mut segments = Vec::new();
    for segment in cwd.split('/') {
        match segment {
            "" | "." => {}
            ".." if segments.pop().is_none() && !absolute => segments.push(".."),
            ".." => {}
            value => segments.push(value),
        }
    }
    let normalized = segments.join("/");
    match (absolute, normalized.is_empty()) {
        (true, true) => "/".to_owned(),
        (true, false) => format!("/{normalized}"),
        (false, true) => ".".to_owned(),
        (false, false) => normalized,
    }
}

fn invalid_params(error: serde_json::Error) -> RuntimeError {
    RuntimeError::Provider(format!("invalid sessions/grouped payload: {error}"))
}

fn parse_rfc3339_epoch(value: &str) -> Option<u64> {
    let (date, time) = value.split_once('T')?;
    let mut date_parts = date.split('-');
    let year = date_parts.next()?.parse::<i64>().ok()?;
    let month = date_parts.next()?.parse::<u32>().ok()?;
    let day = date_parts.next()?.parse::<u32>().ok()?;
    let time = time.trim_end_matches('Z');
    let time = time
        .split_once(['+', '-'])
        .map_or(time, |(time, _offset)| time);
    let mut time_parts = time.split(':');
    let hour = time_parts.next()?.parse::<u32>().ok()?;
    let minute = time_parts.next()?.parse::<u32>().ok()?;
    let second = time_parts.next()?.split('.').next()?.parse::<u32>().ok()?;
    let days = days_from_civil(year, month, day)?;
    let seconds = days
        .checked_mul(SECONDS_PER_DAY as i64)?
        .checked_add((hour * 3600 + minute * 60 + second) as i64)?;
    u64::try_from(seconds).ok()
}

fn days_from_civil(year: i64, month: u32, day: u32) -> Option<i64> {
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let year = year - i64::from(month <= 2);
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let month = i64::from(month);
    let day = i64::from(day);
    let day_of_year = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    Some(era * 146_097 + day_of_era - 719_468)
}
