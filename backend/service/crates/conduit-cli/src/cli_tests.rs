use super::parse_command;
use acp_discovery::ProviderId;
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
    if request.provider != ProviderId::Codex {
        return Err("provider did not parse".into());
    }
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
fn parses_claude_session_list_capture() -> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "claude",
        "session/list",
        "--cwd",
        "/repo",
        "--out",
        "/captures/one",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Claude {
        return Err("provider did not parse".into());
    }
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
fn parses_codex_initialize_capture_with_default_workspace() -> Result<(), Box<dyn std::error::Error>>
{
    let parsed = parse_command(&args(&["capture", "codex", "initialize"]))?;
    let super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Codex {
        return Err("provider did not parse".into());
    }
    if request.operation != super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path() != super::provider_workspace_root(ProviderId::Codex).as_path() {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    Ok(())
}

#[test]
fn parses_claude_initialize_capture_with_default_workspace()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&["capture", "claude", "initialize"]))?;
    let super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Claude {
        return Err("provider did not parse".into());
    }
    if request.operation != super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != Path::new(super::PROVIDER_WORKSPACE_ROOT).join(ProviderId::Claude.as_str())
    {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    Ok(())
}

#[test]
fn parses_copilot_initialize_capture_with_relative_workspace_child()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "copilot",
        "initialize",
        "--cwd",
        "init-smoke",
        "--out",
        "/captures/one",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Copilot {
        return Err("provider did not parse".into());
    }
    if request.operation != super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != Path::new(super::PROVIDER_WORKSPACE_ROOT)
            .join(ProviderId::Copilot.as_str())
            .join("init-smoke")
    {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    if request.output.as_deref() != Some(Path::new("/captures/one")) {
        return Err("output did not parse".into());
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
        != super::provider_workspace_root(ProviderId::Codex)
            .as_path()
            .join("init-smoke")
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
            configs: Vec::new(),
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path() != super::provider_workspace_root(ProviderId::Codex).as_path() {
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
            configs: Vec::new(),
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::provider_workspace_root(ProviderId::Codex)
            .as_path()
            .join("prompt-smoke")
    {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    if request.output.as_deref() != Some(Path::new("/captures/one")) {
        return Err("output did not parse".into());
    }
    Ok(())
}

#[test]
fn parses_codex_session_prompt_capture_with_config_prelude()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "codex",
        "session/prompt",
        "--prompt",
        "/tmp/prompt.json",
        "--config",
        "collaboration_mode",
        "--value",
        "plan",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.operation
        != (super::CaptureOperation::Prompt {
            session_id: None,
            configs: vec![super::CaptureConfigOption {
                config_id: "collaboration_mode".to_owned(),
                value: "plan".to_owned(),
            }],
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    Ok(())
}

#[test]
fn parses_codex_session_prompt_capture_with_multiple_config_preludes()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "codex",
        "session/prompt",
        "--prompt",
        "/tmp/prompt.json",
        "--config",
        "model",
        "--value",
        "gpt-5.4-mini",
        "--config",
        "reasoning_effort",
        "--value",
        "medium",
        "--config",
        "collaboration_mode",
        "--value",
        "plan",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.operation
        != (super::CaptureOperation::Prompt {
            session_id: None,
            configs: vec![
                super::CaptureConfigOption {
                    config_id: "model".to_owned(),
                    value: "gpt-5.4-mini".to_owned(),
                },
                super::CaptureConfigOption {
                    config_id: "reasoning_effort".to_owned(),
                    value: "medium".to_owned(),
                },
                super::CaptureConfigOption {
                    config_id: "collaboration_mode".to_owned(),
                    value: "plan".to_owned(),
                },
            ],
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    Ok(())
}

#[test]
fn parses_codex_session_set_config_option_capture() -> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "codex",
        "session/set_config_option",
        "--session",
        "session-1",
        "--config",
        "reasoning_effort",
        "--value",
        "medium",
        "--cwd",
        "config-smoke",
        "--out",
        "/captures/one",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.operation
        != (super::CaptureOperation::SetConfigOption {
            session_id: Some("session-1".to_owned()),
            config_id: "reasoning_effort".to_owned(),
            value: "medium".to_owned(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::provider_workspace_root(ProviderId::Codex)
            .as_path()
            .join("config-smoke")
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
    if request.cwd.as_path() != super::provider_workspace_root(ProviderId::Codex).as_path() {
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
        != super::provider_workspace_root(ProviderId::Codex)
            .as_path()
            .join("prompt-smoke")
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
    let cwd = super::provider_workspace_root(ProviderId::Codex).join("smoke");
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
fn rejects_unknown_provider() {
    let error = parse_command(&args(&["capture", "other", "initialize"]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    assert!(error.contains("provider must be one of"));
}

#[test]
fn rejects_other_operation() {
    let error = parse_command(&args(&["capture", "codex", "session/open"]))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    assert!(error.contains("session/set_config_option"));
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
fn rejects_session_prompt_config_without_value() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/prompt",
        "--prompt",
        "/tmp/prompt.json",
        "--config",
        "collaboration_mode",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("missing required --value"));
}

#[test]
fn rejects_session_prompt_value_without_config() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/prompt",
        "--prompt",
        "/tmp/prompt.json",
        "--value",
        "plan",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("missing required --config"));
}

#[test]
fn rejects_session_prompt_duplicate_config_prelude() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/prompt",
        "--prompt",
        "/tmp/prompt.json",
        "--config",
        "model",
        "--value",
        "gpt-5.4",
        "--config",
        "model",
        "--value",
        "gpt-5.4-mini",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("duplicate --config model"));
}

#[test]
fn parses_codex_session_set_config_option_capture_without_session_id()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&[
        "capture",
        "codex",
        "session/set_config_option",
        "--config",
        "reasoning_effort",
        "--value",
        "medium",
    ]))?;
    let super::Command::Capture(request) = parsed;
    if request.operation
        != (super::CaptureOperation::SetConfigOption {
            session_id: None,
            config_id: "reasoning_effort".to_owned(),
            value: "medium".to_owned(),
        })
    {
        return Err("operation did not parse".into());
    }
    Ok(())
}

#[test]
fn rejects_session_set_config_option_without_config_id() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/set_config_option",
        "--session",
        "session-1",
        "--value",
        "medium",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("missing required --config"));
}

#[test]
fn rejects_session_set_config_option_without_value() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/set_config_option",
        "--session",
        "session-1",
        "--config",
        "reasoning_effort",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("missing required --value"));
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

#[test]
fn rejects_unknown_session_set_config_option_flag() {
    let error = parse_command(&args(&[
        "capture",
        "codex",
        "session/set_config_option",
        "--session",
        "session-1",
        "--config",
        "reasoning_effort",
        "--value",
        "medium",
        "--provider",
        "codex",
    ]))
    .err()
    .map(|error| error.to_string())
    .unwrap_or_default();
    assert!(error.contains("unsupported flag --provider"));
}
