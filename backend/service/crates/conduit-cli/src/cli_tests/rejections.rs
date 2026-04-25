use super::{args, parse_command};

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
