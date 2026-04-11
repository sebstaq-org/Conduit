//! Provider-specific proof-home seeding.

use crate::error::{Result, ServiceError};
use acp_discovery::ProviderId;
use std::fs::{copy, create_dir_all, read_dir};
use std::path::{Path, PathBuf};

struct CopyRule {
    source: PathBuf,
    destination: PathBuf,
    required: bool,
}

pub(super) fn seed_provider_home(provider: ProviderId, proof_home: &Path) -> Result<()> {
    let real_home = real_home()?;
    create_path(&proof_home.join(".config"))?;
    for rule in provider_rules(provider, &real_home, proof_home) {
        copy_rule(&rule)?;
    }
    Ok(())
}

fn provider_rules(provider: ProviderId, real_home: &Path, proof_home: &Path) -> Vec<CopyRule> {
    match provider {
        ProviderId::Claude => claude_rules(real_home, proof_home),
        ProviderId::Copilot => copilot_rules(real_home, proof_home),
        ProviderId::Codex => codex_rules(real_home, proof_home),
    }
}

fn claude_rules(real_home: &Path, proof_home: &Path) -> Vec<CopyRule> {
    vec![
        optional_file(
            real_home.join(".claude/.credentials.json"),
            proof_home.join(".claude/.credentials.json"),
        ),
        optional_file(
            real_home.join(".claude/settings.json"),
            proof_home.join(".claude/settings.json"),
        ),
        optional_file(
            real_home.join(".claude/settings.local.json"),
            proof_home.join(".claude/settings.local.json"),
        ),
        optional_file(
            real_home.join(".claude/mcp-needs-auth-cache.json"),
            proof_home.join(".claude/mcp-needs-auth-cache.json"),
        ),
    ]
}

fn copilot_rules(real_home: &Path, proof_home: &Path) -> Vec<CopyRule> {
    vec![
        optional_file(
            real_home.join(".copilot/config.json"),
            proof_home.join(".copilot/config.json"),
        ),
        optional_file(
            real_home.join(".copilot/mcp-config.json"),
            proof_home.join(".copilot/mcp-config.json"),
        ),
        optional_file(
            real_home.join(".copilot/session-store.db"),
            proof_home.join(".copilot/session-store.db"),
        ),
        optional_directory(
            real_home.join(".copilot/mcp-oauth-config"),
            proof_home.join(".copilot/mcp-oauth-config"),
        ),
    ]
}

fn codex_rules(real_home: &Path, proof_home: &Path) -> Vec<CopyRule> {
    vec![
        optional_file(
            real_home.join(".codex/auth.json"),
            proof_home.join(".codex/auth.json"),
        ),
        optional_file(
            real_home.join(".codex/config.toml"),
            proof_home.join(".codex/config.toml"),
        ),
        optional_file(
            real_home.join(".config/codex/github.env"),
            proof_home.join(".config/codex/github.env"),
        ),
        optional_file(
            real_home.join(".config/codex/profiles.json"),
            proof_home.join(".config/codex/profiles.json"),
        ),
    ]
}

fn copy_rule(rule: &CopyRule) -> Result<()> {
    if !rule.source.exists() {
        if rule.required {
            return Err(ServiceError::InvalidCapture {
                message: format!("required proof seed missing: {}", rule.source.display()),
            });
        }
        return Ok(());
    }
    if rule.source.is_file() {
        copy_file(&rule.source, &rule.destination)?;
    } else if rule.source.is_dir() {
        copy_directory(&rule.source, &rule.destination)?;
    }
    Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> Result<()> {
    create_parent(destination)?;
    create_path(destination)?;
    for entry in read_dir(source).map_err(|source_error| ServiceError::PreparePath {
        path: source.to_path_buf(),
        source: source_error,
    })? {
        let entry = entry.map_err(|source_error| ServiceError::PreparePath {
            path: source.to_path_buf(),
            source: source_error,
        })?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_file() {
            copy_file(&source_path, &destination_path)?;
        }
    }
    Ok(())
}

fn copy_file(source: &Path, destination: &Path) -> Result<()> {
    create_parent(destination)?;
    copy(source, destination).map_err(|source_error| ServiceError::PreparePath {
        path: destination.to_path_buf(),
        source: source_error,
    })?;
    Ok(())
}

fn create_parent(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        create_path(parent)?;
    }
    Ok(())
}

fn create_path(path: &Path) -> Result<()> {
    create_dir_all(path).map_err(|source| ServiceError::PreparePath {
        path: path.to_path_buf(),
        source,
    })
}

fn optional_directory(source: PathBuf, destination: PathBuf) -> CopyRule {
    CopyRule {
        source,
        destination,
        required: false,
    }
}

fn optional_file(source: PathBuf, destination: PathBuf) -> CopyRule {
    CopyRule {
        source,
        destination,
        required: false,
    }
}

fn real_home() -> Result<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| ServiceError::InvalidCapture {
            message: "HOME was not available while preparing proof workspace".to_owned(),
        })
}
