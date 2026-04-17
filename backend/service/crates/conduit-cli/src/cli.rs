//! Argument parsing for the Conduit operator CLI.

use crate::error::{CliError, Result};
use std::path::PathBuf;

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
    /// Official ACP `session/list`.
    SessionList,
    /// Official ACP `session/load`.
    SessionLoad {
        /// ACP session id returned by the provider.
        session_id: String,
    },
}

/// Parses top-level CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    match args {
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/list" =>
        {
            Ok(Command::Capture(parse_session_list_capture(rest)?))
        }
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/load" =>
        {
            Ok(Command::Capture(parse_session_load_capture(rest)?))
        }
        [capture, ..] if capture == "capture" => Err(CliError::invalid_command(
            "unsupported capture command; expected: conduit capture codex session/list or conduit capture codex session/load",
        )),
        [] => Err(CliError::invalid_command(
            "missing command; expected: conduit capture codex session/list or conduit capture codex session/load",
        )),
        [command, ..] => Err(CliError::invalid_command(format!(
            "unsupported command {command}; expected: conduit capture codex session/list or conduit capture codex session/load"
        ))),
    }
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
        operation: CaptureOperation::SessionList,
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
        operation: CaptureOperation::SessionLoad { session_id },
        cwd,
        output,
    })
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
        if request.operation != super::CaptureOperation::SessionList {
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
            != (super::CaptureOperation::SessionLoad {
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
    fn rejects_other_provider() {
        let error = parse_command(&args(&["capture", "claude", "session/list"]))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("unsupported capture command"));
    }

    #[test]
    fn rejects_other_operation() {
        let error = parse_command(&args(&["capture", "codex", "session/new"]))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("unsupported capture command"));
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
}
