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
    /// Working directory sent to provider `session/list`.
    pub(crate) cwd: PathBuf,
    /// Explicit output directory, if provided.
    pub(crate) output: Option<PathBuf>,
}

/// Parses top-level CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    match args {
        [capture, provider, operation, rest @ ..]
            if capture == "capture" && provider == "codex" && operation == "session/list" =>
        {
            Ok(Command::Capture(parse_capture_options(rest)?))
        }
        [capture, ..] if capture == "capture" => Err(CliError::invalid_command(
            "unsupported capture command; expected: conduit capture codex session/list",
        )),
        [] => Err(CliError::invalid_command(
            "missing command; expected: conduit capture codex session/list",
        )),
        [command, ..] => Err(CliError::invalid_command(format!(
            "unsupported command {command}; expected: conduit capture codex session/list"
        ))),
    }
}

fn parse_capture_options(args: &[String]) -> Result<CaptureRequest> {
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
        cwd: cwd.unwrap_or(std::env::current_dir()?),
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
}
