//! Argument parsing for the Conduit operator CLI.

use crate::error::{CliError, Result};
use std::path::{Component, Path, PathBuf};

const CODEX_PROVIDER_WORKSPACE_ROOT: &str =
    "/srv/devops/repos/conduit-artifacts/manual/provider-workspaces/codex";

/// Parsed CLI command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Command {
    /// Captures live provider ACP data.
    Capture(CaptureRequest),
}

/// One provider capture request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CaptureRequest {
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
        /// JSON file containing the top-level ACP `ContentBlock[]` payload.
        prompt_path: PathBuf,
    },
}

/// Parses top-level CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    match args {
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "initialize" =>
        {
            Ok(Command::Capture(parse_initialize_capture(rest)?))
        }
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/list" =>
        {
            Ok(Command::Capture(parse_session_list_capture(rest)?))
        }
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/new" =>
        {
            Ok(Command::Capture(parse_session_new_capture(rest)?))
        }
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/load" =>
        {
            Ok(Command::Capture(parse_session_load_capture(rest)?))
        }
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/prompt" =>
        {
            Ok(Command::Capture(parse_session_prompt_capture(rest)?))
        }
        [capture, ..] if capture == "capture" => Err(CliError::invalid_command(
            "unsupported capture command; expected: conduit capture codex initialize, conduit capture codex session/new, conduit capture codex session/list, conduit capture codex session/load, or conduit capture codex session/prompt",
        )),
        [] => Err(CliError::invalid_command(
            "missing command; expected: conduit capture codex initialize, conduit capture codex session/new, conduit capture codex session/list, conduit capture codex session/load, or conduit capture codex session/prompt",
        )),
        [command, ..] => Err(CliError::invalid_command(format!(
            "unsupported command {command}; expected: conduit capture codex initialize, conduit capture codex session/new, conduit capture codex session/list, conduit capture codex session/load, or conduit capture codex session/prompt"
        ))),
    }
}

fn parse_initialize_capture(args: &[String]) -> Result<CaptureRequest> {
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
        operation: CaptureOperation::Initialize,
        cwd: provider_workspace_cwd(cwd)?,
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
        operation: CaptureOperation::New,
        cwd: provider_workspace_cwd(cwd)?,
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
        operation: CaptureOperation::Load { session_id },
        cwd,
        output,
    })
}

fn parse_session_prompt_capture(args: &[String]) -> Result<CaptureRequest> {
    let mut cwd = None;
    let mut output = None;
    let mut prompt_path = None;
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
            "--prompt" => prompt_path = Some(PathBuf::from(value)),
            "--session" => session_id = Some(value.to_owned()),
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
    Ok(CaptureRequest {
        operation: CaptureOperation::Prompt {
            session_id,
            prompt_path,
        },
        cwd: provider_workspace_cwd(cwd)?,
        output,
    })
}

fn provider_workspace_cwd(configured: Option<PathBuf>) -> Result<PathBuf> {
    let root = lexical_normalize(Path::new(CODEX_PROVIDER_WORKSPACE_ROOT));
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
mod tests {
    use super::parse_command;
    use std::path::Path;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn parses_codex_session_list_capture() -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/list",
            "--cwd",
            "/repo",
            "--out",
            "/captures/one",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation != super::CaptureOperation::List {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path() != Path::new("/repo") {
            return Err("cwd did not parse".into());
        }
        if request.output.as_deref() != Some(Path::new("/captures/one")) {
            return Err("output did not parse".into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_initialize_capture_with_default_workspace()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&["capture", "codex", "initialize"]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation != super::CaptureOperation::Initialize {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path() != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT) {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_initialize_capture_with_relative_workspace_child()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "initialize",
            "--cwd",
            "init-smoke",
            "--out",
            "/captures/one",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation != super::CaptureOperation::Initialize {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path()
            != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT).join("init-smoke")
        {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        if request.output.as_deref() != Some(Path::new("/captures/one")) {
            return Err("output did not parse".into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_load_capture() -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/load",
            "--session",
            "session-1",
            "--cwd",
            "/repo",
            "--out",
            "/captures/one",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation
            != (super::CaptureOperation::Load {
                session_id: "session-1".to_owned(),
            })
        {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path() != Path::new("/repo") {
            return Err("cwd did not parse".into());
        }
        if request.output.as_deref() != Some(Path::new("/captures/one")) {
            return Err("output did not parse".into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_prompt_capture_with_default_workspace()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/prompt",
            "--prompt",
            "/tmp/prompt.json",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation
            != (super::CaptureOperation::Prompt {
                session_id: None,
                prompt_path: "/tmp/prompt.json".into(),
            })
        {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path() != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT) {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_prompt_capture_with_existing_session()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/prompt",
            "--session",
            "session-1",
            "--prompt",
            "/tmp/prompt.json",
            "--cwd",
            "prompt-smoke",
            "--out",
            "/captures/one",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation
            != (super::CaptureOperation::Prompt {
                session_id: Some("session-1".to_owned()),
                prompt_path: "/tmp/prompt.json".into(),
            })
        {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path()
            != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT).join("prompt-smoke")
        {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        if request.output.as_deref() != Some(Path::new("/captures/one")) {
            return Err("output did not parse".into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_new_capture_with_default_workspace()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&["capture", "codex", "session/new"]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation != super::CaptureOperation::New {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path() != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT) {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_new_capture_with_relative_workspace_child()
    -> Result<(), Box<dyn std::error::Error>> {
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/new",
            "--cwd",
            "prompt-smoke",
            "--out",
            "/captures/one",
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.operation != super::CaptureOperation::New {
            return Err("operation did not parse".into());
        }
        if request.cwd.as_path()
            != Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT).join("prompt-smoke")
        {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        if request.output.as_deref() != Some(Path::new("/captures/one")) {
            return Err("output did not parse".into());
        }
        Ok(())
    }

    #[test]
    fn parses_codex_session_new_capture_with_absolute_workspace_child()
    -> Result<(), Box<dyn std::error::Error>> {
        let cwd = Path::new(super::CODEX_PROVIDER_WORKSPACE_ROOT).join("smoke");
        let parsed = parse_command(&args(&[
            "capture",
            "codex",
            "session/new",
            "--cwd",
            cwd.to_str().ok_or("cwd was not utf8")?,
        ]))?;
        let super::Command::Capture(request) = parsed;
        if request.cwd != cwd {
            return Err(format!("unexpected cwd {}", request.cwd.display()).into());
        }
        Ok(())
    }

    #[test]
    fn rejects_other_provider() {
        let error = parse_command(&args(&["capture", "claude", "session/list"]))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("unsupported capture command"));
    }

    #[test]
    fn rejects_other_operation() {
        let error = parse_command(&args(&["capture", "codex", "session/open"]))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("unsupported capture command"));
    }

    #[test]
    fn rejects_session_new_workspace_escape() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/new",
            "--cwd",
            "../outside",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("must stay under"));
    }

    #[test]
    fn rejects_initialize_workspace_escape() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "initialize",
            "--cwd",
            "../outside",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("must stay under"));
    }

    #[test]
    fn rejects_session_new_absolute_workspace_escape() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/new",
            "--cwd",
            "/srv/devops/repos/w3/Conduit",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("must stay under"));
    }

    #[test]
    fn rejects_session_prompt_workspace_escape() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/prompt",
            "--prompt",
            "/tmp/prompt.json",
            "--cwd",
            "../outside",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("must stay under"));
    }

    #[test]
    fn rejects_session_load_without_cwd() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/load",
            "--session",
            "session-1",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("missing required --cwd"));
    }

    #[test]
    fn rejects_session_load_without_session_id() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/load",
            "--cwd",
            "/repo",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("missing required --session"));
    }

    #[test]
    fn rejects_session_prompt_without_prompt_file() {
        let error = parse_command(&args(&["capture", "codex", "session/prompt"]))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("missing required --prompt"));
    }

    #[test]
    fn rejects_unknown_flag() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/list",
            "--provider",
            "codex",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("unsupported flag --provider"));
    }

    #[test]
    fn rejects_unknown_session_load_flag() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/load",
            "--session",
            "session-1",
            "--cwd",
            "/repo",
            "--provider",
            "codex",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("unsupported flag --provider"));
    }

    #[test]
    fn rejects_unknown_session_prompt_flag() {
        let error = parse_command(&args(&[
            "capture",
            "codex",
            "session/prompt",
            "--prompt",
            "/tmp/prompt.json",
            "--provider",
            "codex",
        ]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("unsupported flag --provider"));
    }
}
