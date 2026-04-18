//! Argument parsing for the Conduit operator CLI.

use crate::error::{CliError, Result};
use acp_discovery::ProviderId;
use std::path::{Component, Path, PathBuf};
use std::str::FromStr;

const PROVIDER_WORKSPACE_ROOT: &str =
    "/srv/devops/repos/conduit-artifacts/manual/provider-workspaces";

/// Parsed CLI command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Command {
    /// Captures live provider ACP data.
    Capture(CaptureRequest),
}

/// One provider capture request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CaptureRequest {
    /// Provider to capture.
    pub(crate) provider: ProviderId,
    /// Provider operation to capture.
    pub(crate) operation: CaptureOperation,
    /// Working directory sent to the provider operation.
    pub(crate) cwd: PathBuf,
    /// Explicit output directory, if provided.
    pub(crate) output: Option<PathBuf>,
}

/// Supported provider capture operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CaptureOperation {
    /// Official ACP `initialize`.
    Initialize,
    /// Official ACP `session/new`.
    New,
    /// Official ACP `session/list`.
    List,
    /// Official ACP `session/load`.
    Load {
        /// ACP session id returned by the provider.
        session_id: String,
    },
    /// Official ACP `session/prompt`.
    Prompt {
        /// ACP session id returned by the provider, when reusing a session.
        session_id: Option<String>,
        /// Optional ACP config option to set before sending the prompt.
        config: Option<CaptureConfigOption>,
        /// JSON file containing the top-level ACP `ContentBlock[]` payload.
        prompt_path: PathBuf,
    },
    /// Official ACP `session/set_config_option`.
    SetConfigOption {
        /// ACP session id returned by the provider.
        session_id: Option<String>,
        /// ACP config option id to set.
        config_id: String,
        /// ACP config option value to set.
        value: String,
    },
}

/// One ACP config option assignment used as a capture prelude.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CaptureConfigOption {
    /// ACP config option id to set.
    pub(crate) config_id: String,
    /// ACP config option value to set.
    pub(crate) value: String,
}

/// Parses top-level CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    match args {
        [capture, provider, operation, rest @ ..] if capture == "capture" => {
            let provider = parse_provider(provider)?;
            if operation == "initialize" {
                return Ok(Command::Capture(parse_initialize_capture(provider, rest)?));
            }
            if provider != ProviderId::Codex {
                return Err(CliError::invalid_command(
                    "unsupported capture command; only initialize is supported for claude and copilot",
                ));
            }
            parse_codex_capture(operation, rest)
        }
        [capture, ..] if capture == "capture" => {
            Err(CliError::invalid_command(expected_capture_commands()))
        }
        [] => Err(CliError::invalid_command(format!(
            "missing command; expected: {}",
            expected_capture_commands()
        ))),
        [command, ..] => Err(CliError::invalid_command(format!(
            "unsupported command {command}; expected: {}",
            expected_capture_commands()
        ))),
    }
}

fn parse_codex_capture(operation: &str, args: &[String]) -> Result<Command> {
    match operation {
        "session/list" => Ok(Command::Capture(parse_session_list_capture(args)?)),
        "session/new" => Ok(Command::Capture(parse_session_new_capture(args)?)),
        "session/load" => Ok(Command::Capture(parse_session_load_capture(args)?)),
        "session/prompt" => Ok(Command::Capture(parse_session_prompt_capture(args)?)),
        "session/set_config_option" => Ok(Command::Capture(
            parse_session_set_config_option_capture(args)?,
        )),
        _ => Err(CliError::invalid_command(expected_capture_commands())),
    }
}

fn parse_provider(value: &str) -> Result<ProviderId> {
    ProviderId::from_str(value).map_err(CliError::invalid_command)
}

fn expected_capture_commands() -> &'static str {
    "conduit capture <claude|copilot|codex> initialize, conduit capture codex session/new, conduit capture codex session/list, conduit capture codex session/load, conduit capture codex session/prompt, or conduit capture codex session/set_config_option"
}

fn parse_initialize_capture(provider: ProviderId, args: &[String]) -> Result<CaptureRequest> {
    let mut cwd = None;
    let mut output = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--cwd" => cwd = Some(PathBuf::from(value)),
            "--out" => output = Some(PathBuf::from(value)),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    Ok(CaptureRequest {
        provider,
        operation: CaptureOperation::Initialize,
        cwd: provider_workspace_cwd(provider, cwd)?,
        output,
    })
}

fn parse_session_new_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut cwd = None;
    let mut output = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--cwd" => cwd = Some(PathBuf::from(value)),
            "--out" => output = Some(PathBuf::from(value)),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    Ok(CaptureRequest {
        provider: ProviderId::Codex,
        operation: CaptureOperation::New,
        cwd: provider_workspace_cwd(ProviderId::Codex, cwd)?,
        output,
    })
}

fn parse_session_list_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut cwd = None;
    let mut output = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--cwd" => cwd = Some(PathBuf::from(value)),
            "--out" => output = Some(PathBuf::from(value)),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    Ok(CaptureRequest {
        provider: ProviderId::Codex,
        operation: CaptureOperation::List,
        cwd: cwd.unwrap_or(std::env::current_dir()?),
        output,
    })
}

fn parse_session_load_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut cwd = None;
    let mut output = None;
    let mut session_id = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--cwd" => cwd = Some(PathBuf::from(value)),
            "--out" => output = Some(PathBuf::from(value)),
            "--session" => session_id = Some(value.to_owned()),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    let cwd = cwd.ok_or_else(|| {
        CliError::invalid_command("missing required --cwd for codex session/load capture")
    })?;
    let session_id = session_id.ok_or_else(|| {
        CliError::invalid_command("missing required --session for codex session/load capture")
    })?;
    Ok(CaptureRequest {
        provider: ProviderId::Codex,
        operation: CaptureOperation::Load { session_id },
        cwd,
        output,
    })
}

fn parse_session_prompt_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut config_id = None;
    let mut cwd = None;
    let mut output = None;
    let mut prompt_path = None;
    let mut session_id = None;
    let mut value = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(flag_value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--config" => config_id = Some(flag_value.to_owned()),
            "--cwd" => cwd = Some(PathBuf::from(flag_value)),
            "--out" => output = Some(PathBuf::from(flag_value)),
            "--prompt" => prompt_path = Some(PathBuf::from(flag_value)),
            "--session" => session_id = Some(flag_value.to_owned()),
            "--value" => value = Some(flag_value.to_owned()),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    let prompt_path = prompt_path.ok_or_else(|| {
        CliError::invalid_command("missing required --prompt for codex session/prompt capture")
    })?;
    let config = parse_optional_config_option(config_id, value, "codex session/prompt capture")?;
    Ok(CaptureRequest {
        provider: ProviderId::Codex,
        operation: CaptureOperation::Prompt {
            session_id,
            config,
            prompt_path,
        },
        cwd: provider_workspace_cwd(ProviderId::Codex, cwd)?,
        output,
    })
}

fn parse_session_set_config_option_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut config_id = None;
    let mut cwd = None;
    let mut output = None;
    let mut session_id = None;
    let mut value = None;
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let Some(flag_value) = args.get(index + 1) else {
            return Err(CliError::invalid_command(format!(
                "missing value for {flag}"
            )));
        };
        match flag.as_str() {
            "--config" => config_id = Some(flag_value.to_owned()),
            "--cwd" => cwd = Some(PathBuf::from(flag_value)),
            "--out" => output = Some(PathBuf::from(flag_value)),
            "--session" => session_id = Some(flag_value.to_owned()),
            "--value" => value = Some(flag_value.to_owned()),
            _ => {
                return Err(CliError::invalid_command(format!(
                    "unsupported flag {flag}"
                )));
            }
        }
        index += 2;
    }
    let config_id = config_id.ok_or_else(|| {
        CliError::invalid_command(
            "missing required --config for codex session/set_config_option capture",
        )
    })?;
    let value = value.ok_or_else(|| {
        CliError::invalid_command(
            "missing required --value for codex session/set_config_option capture",
        )
    })?;
    Ok(CaptureRequest {
        provider: ProviderId::Codex,
        operation: CaptureOperation::SetConfigOption {
            session_id,
            config_id,
            value,
        },
        cwd: provider_workspace_cwd(ProviderId::Codex, cwd)?,
        output,
    })
}

fn parse_optional_config_option(
    config_id: Option<String>,
    value: Option<String>,
    command: &str,
) -> Result<Option<CaptureConfigOption>> {
    match (config_id, value) {
        (Some(config_id), Some(value)) => Ok(Some(CaptureConfigOption { config_id, value })),
        (Some(_), None) => Err(CliError::invalid_command(format!(
            "missing required --value for {command} when --config is provided"
        ))),
        (None, Some(_)) => Err(CliError::invalid_command(format!(
            "missing required --config for {command} when --value is provided"
        ))),
        (None, None) => Ok(None),
    }
}

fn provider_workspace_cwd(provider: ProviderId, configured: Option<PathBuf>) -> Result<PathBuf> {
    let root = provider_workspace_root(provider);
    let candidate = match configured {
        Some(path) if path.is_absolute() => path,
        Some(path) => root.join(path),
        None => root.clone(),
    };
    let normalized = lexical_normalize(&candidate);
    if normalized.starts_with(&root) {
        return Ok(normalized);
    }
    Err(CliError::invalid_command(format!(
        "capture cwd must stay under {}",
        root.display()
    )))
}

fn provider_workspace_root(provider: ProviderId) -> PathBuf {
    lexical_normalize(&Path::new(PROVIDER_WORKSPACE_ROOT).join(provider.as_str()))
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new("/")),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(value) => normalized.push(value),
        }
    }
    normalized
}

#[cfg(test)]
#[path = "cli_tests.rs"]
mod tests;
