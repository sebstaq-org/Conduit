//! Public-repository hygiene scans for committed fixtures.

use super::common::{
    REQUIRED_SCENARIO_FILES, ValidationContext, ValidationResult, failure, protocol_capture_name,
    sorted_files,
};
use std::fs::read_to_string;
use std::path::Path;

pub(crate) fn validate_fixture_file_hygiene(
    scenario_path: &Path,
    provider: &str,
    scenario: &str,
) -> ValidationResult<()> {
    let Some(dir) = scenario_path.parent() else {
        return Err(failure(
            ValidationContext {
                provider,
                scenario,
                path: scenario_path,
            },
            "scenario path had no parent",
        ));
    };
    for file_name in REQUIRED_SCENARIO_FILES {
        let path = dir.join(file_name);
        validate_file_hygiene(ValidationContext {
            provider,
            scenario,
            path: &path,
        })?;
    }
    Ok(())
}

pub(crate) fn validate_protocol_file_hygiene(
    protocol_root: &Path,
    provider: &str,
) -> ValidationResult<()> {
    for path in sorted_files(protocol_root, provider, "<protocol>")? {
        validate_file_hygiene(ValidationContext {
            provider,
            scenario: protocol_capture_name(&path),
            path: &path,
        })?;
    }
    Ok(())
}

fn validate_file_hygiene(context: ValidationContext<'_, '_>) -> ValidationResult<()> {
    let contents = read_to_string(context.path)
        .map_err(|error| failure(context, format!("could not read fixture: {error}")))?;
    validate_hygiene_text(context, &contents)
}

pub(crate) fn validate_hygiene_text(
    context: ValidationContext<'_, '_>,
    text: &str,
) -> ValidationResult<()> {
    for forbidden in ["/srv/", "/home/", "/Users/", "/tmp/"] {
        if text.contains(forbidden) {
            return Err(failure(
                context,
                format!("public fixture hygiene forbids local path marker {forbidden}"),
            ));
        }
    }
    for forbidden in ["artifacts/manual", "_proof-workspaces", "CONDUIT_READY"] {
        if text.contains(forbidden) {
            return Err(failure(
                context,
                format!("public fixture hygiene forbids raw manual marker {forbidden}"),
            ));
        }
    }
    if contains_live_uuid(text) {
        return Err(failure(
            context,
            "public fixture hygiene forbids raw UUID-like live session ids",
        ));
    }
    if contains_secret_pattern(text) {
        return Err(failure(
            context,
            "public fixture hygiene forbids obvious secret/token patterns",
        ));
    }
    Ok(())
}

fn contains_secret_pattern(text: &str) -> bool {
    text.contains("-----BEGIN ")
        || text.contains("Authorization: Bearer ")
        || text.contains("\"Bearer ")
        || text.contains("sk-")
        || text.contains("ghp_")
        || text.contains("github_pat_")
        || text.contains("xoxb-")
        || text
            .split(|character: char| !character.is_ascii_alphanumeric())
            .any(|part| part.len() == 20 && part.starts_with("AKIA"))
}

fn contains_live_uuid(text: &str) -> bool {
    text.split(uuid_boundary)
        .any(|part| part.len() == 36 && is_uuid_like(part))
}

fn uuid_boundary(character: char) -> bool {
    !(character.is_ascii_hexdigit() || character == '-')
}

fn is_uuid_like(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.get(8) != Some(&b'-')
        || bytes.get(13) != Some(&b'-')
        || bytes.get(18) != Some(&b'-')
        || bytes.get(23) != Some(&b'-')
    {
        return false;
    }
    value
        .chars()
        .enumerate()
        .all(|(index, character)| [8, 13, 18, 23].contains(&index) || character.is_ascii_hexdigit())
}
