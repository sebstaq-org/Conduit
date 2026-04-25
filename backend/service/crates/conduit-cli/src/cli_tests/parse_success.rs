use super::{Path, ProviderId, args, parse_command};

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
    let super::super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Codex {
        return Err("provider did not parse".into());
    }
    if request.operation != super::super::CaptureOperation::List {
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
    let super::super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Claude {
        return Err("provider did not parse".into());
    }
    if request.operation != super::super::CaptureOperation::List {
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
    let super::super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Codex {
        return Err("provider did not parse".into());
    }
    if request.operation != super::super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path() != super::super::provider_workspace_root(ProviderId::Codex).as_path() {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    Ok(())
}

#[test]
fn parses_claude_initialize_capture_with_default_workspace()
-> Result<(), Box<dyn std::error::Error>> {
    let parsed = parse_command(&args(&["capture", "claude", "initialize"]))?;
    let super::super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Claude {
        return Err("provider did not parse".into());
    }
    if request.operation != super::super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != Path::new(super::super::PROVIDER_WORKSPACE_ROOT).join(ProviderId::Claude.as_str())
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
    let super::super::Command::Capture(request) = parsed;
    if request.provider != ProviderId::Copilot {
        return Err("provider did not parse".into());
    }
    if request.operation != super::super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != Path::new(super::super::PROVIDER_WORKSPACE_ROOT)
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation != super::super::CaptureOperation::Initialize {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::super::provider_workspace_root(ProviderId::Codex)
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::Load {
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::Prompt {
            session_id: None,
            configs: Vec::new(),
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path() != super::super::provider_workspace_root(ProviderId::Codex).as_path() {
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::Prompt {
            session_id: Some("session-1".to_owned()),
            configs: Vec::new(),
            prompt_path: "/tmp/prompt.json".into(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::super::provider_workspace_root(ProviderId::Codex)
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::Prompt {
            session_id: None,
            configs: vec![super::super::CaptureConfigOption {
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::Prompt {
            session_id: None,
            configs: vec![
                super::super::CaptureConfigOption {
                    config_id: "model".to_owned(),
                    value: "gpt-5.4-mini".to_owned(),
                },
                super::super::CaptureConfigOption {
                    config_id: "reasoning_effort".to_owned(),
                    value: "medium".to_owned(),
                },
                super::super::CaptureConfigOption {
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::SetConfigOption {
            session_id: Some("session-1".to_owned()),
            config_id: "reasoning_effort".to_owned(),
            value: "medium".to_owned(),
        })
    {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::super::provider_workspace_root(ProviderId::Codex)
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation != super::super::CaptureOperation::New {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path() != super::super::provider_workspace_root(ProviderId::Codex).as_path() {
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation != super::super::CaptureOperation::New {
        return Err("operation did not parse".into());
    }
    if request.cwd.as_path()
        != super::super::provider_workspace_root(ProviderId::Codex)
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
    let cwd = super::super::provider_workspace_root(ProviderId::Codex).join("smoke");
    let parsed = parse_command(&args(&[
        "capture",
        "codex",
        "session/new",
        "--cwd",
        cwd.to_str().ok_or("cwd was not utf8")?,
    ]))?;
    let super::super::Command::Capture(request) = parsed;
    if request.cwd != cwd {
        return Err(format!("unexpected cwd {}", request.cwd.display()).into());
    }
    Ok(())
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
    let super::super::Command::Capture(request) = parsed;
    if request.operation
        != (super::super::CaptureOperation::SetConfigOption {
            session_id: None,
            config_id: "reasoning_effort".to_owned(),
            value: "medium".to_owned(),
        })
    {
        return Err("operation did not parse".into());
    }
    Ok(())
}
