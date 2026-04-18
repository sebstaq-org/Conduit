//! Real initialize probing for official ACP adapters.

mod process;

use crate::environment::ProcessEnvironment;
use crate::error::{DiscoveryError, Result};
use crate::path::resolve_executable;
use crate::provider::{LauncherCommand, ProviderId, provider_launcher};
use acp_contracts::{
    LockedMethod, load_locked_contract_bundle, validate_locked_request_envelope,
    validate_locked_response_envelope,
};
use agent_client_protocol_schema::{
    AGENT_METHOD_NAMES, AgentSide, ClientRequest, ClientSide, Implementation, InitializeRequest,
    InitializeResponse, JsonRpcMessage, OutgoingMessage, ProtocolVersion, Request,
};
use process::{
    build_diagnostics, read_initialize_response, send_initialize_request, spawn_provider_process,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, to_value};
use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
};

/// The initialize probe result returned by discovery.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InitializeProbe {
    /// The raw initialize response envelope.
    pub response: Value,
    /// The typed initialize response payload.
    pub payload: InitializeResponse,
    /// The raw stdout lines observed during initialize.
    pub stdout_lines: Vec<String>,
    /// The raw stderr lines observed during initialize.
    pub stderr_lines: Vec<String>,
    /// The measured initialize response time in milliseconds.
    pub elapsed_ms: u64,
}

/// The discovery output for a provider.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderDiscovery {
    /// The provider identifier.
    pub provider: ProviderId,
    /// The launcher command locked by policy.
    pub launcher: LauncherCommand,
    /// The resolved binary path.
    pub resolved_path: String,
    /// The version reported by the adapter.
    pub version: String,
    /// Human-readable auth hints surfaced by the adapter.
    pub auth_hints: Vec<String>,
    /// Whether `initialize` completed successfully.
    pub initialize_viable: bool,
    /// Diagnostics gathered during probing.
    pub transport_diagnostics: Vec<String>,
    /// The raw initialize result when probing succeeded.
    pub initialize_probe: InitializeProbe,
}

/// The discovery output for all three providers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiscoveryCatalog {
    /// The discovery rows keyed by provider order.
    pub providers: Vec<ProviderDiscovery>,
}

/// Discovers one official provider launcher and probes `initialize`.
///
/// # Errors
///
/// Returns an error when the launcher cannot be resolved, the provider process
/// cannot be spawned, the initialize exchange times out, or the raw ACP traffic
/// fails contract validation for the locked subset.
pub fn discover_provider(provider: ProviderId) -> Result<ProviderDiscovery> {
    discover_provider_with_environment(provider, &ProcessEnvironment::empty())
}

/// Discovers one official provider launcher and probes `initialize` with an
/// explicit process environment.
///
/// # Errors
///
/// Returns an error under the same conditions as [`discover_provider`] while
/// also applying the supplied launcher environment overrides.
pub fn discover_provider_with_environment(
    provider: ProviderId,
    environment: &ProcessEnvironment,
) -> Result<ProviderDiscovery> {
    tracing::info!(
        event_name = "provider_discovery.start",
        source = "acp-discovery",
        provider = %provider.as_str()
    );
    let launcher = resolve_provider_command(provider)?;
    let resolved = launcher.executable.clone();
    let (probe, diagnostics) = probe_initialize(provider, &launcher, environment)?;
    let version = response_version(provider, &probe.payload)?;
    let auth_hints = response_auth_hints(&probe.response);

    let discovery = ProviderDiscovery {
        provider,
        launcher,
        resolved_path: resolved.display().to_string(),
        version,
        auth_hints,
        initialize_viable: true,
        transport_diagnostics: diagnostics,
        initialize_probe: probe,
    };
    tracing::info!(
        event_name = "provider_discovery.finish",
        source = "acp-discovery",
        provider = %provider.as_str(),
        ok = true,
        resolved_path = %discovery.resolved_path,
        elapsed_ms = discovery.initialize_probe.elapsed_ms
    );
    Ok(discovery)
}

/// Resolves the exact official launcher command for a provider without probing it.
///
/// # Errors
///
/// Returns an error when the policy-locked provider executable cannot be
/// resolved on `PATH`.
pub fn resolve_provider_command(provider: ProviderId) -> Result<LauncherCommand> {
    let launcher_spec = provider_launcher(provider);
    let resolved = if provider == ProviderId::Codex {
        resolve_managed_codex_acp(launcher_spec.program)?
    } else {
        resolve_executable(launcher_spec.program)?
    };
    let command = LauncherCommand {
        executable: resolved,
        args: launcher_spec.args.iter().map(ToString::to_string).collect(),
        display: launcher_spec.display.to_owned(),
    };
    tracing::debug!(
        event_name = "provider_discovery.resolve_command",
        source = "acp-discovery",
        provider = %provider.as_str(),
        executable = %command.executable.display(),
        display = %command.display
    );
    Ok(command)
}

fn resolve_managed_codex_acp(program: &str) -> Result<PathBuf> {
    let candidates = managed_codex_acp_candidates();
    for candidate in &candidates {
        if candidate.is_file() {
            return std::fs::canonicalize(candidate).map_err(|source| {
                DiscoveryError::CanonicalizePath {
                    path: candidate.clone(),
                    source,
                }
            });
        }
    }

    Err(DiscoveryError::ManagedExecutableNotFound {
        program: program.to_owned(),
        candidates,
    })
}

fn managed_codex_acp_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_exe) = env::current_exe()
        && let Some(parent) = current_exe.parent()
    {
        candidates.push(parent.join("codex-acp"));
    }
    if let Some(root) = repo_root() {
        candidates.push(root.join(".conduit/bin/codex-acp"));
        candidates.push(root.join("vendor/codex-acp/target/release/codex-acp"));
    }
    candidates
}

fn repo_root() -> Option<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()?
        .parent()?
        .parent()?
        .parent()
        .map(Path::to_path_buf)
}

fn probe_initialize(
    provider: ProviderId,
    launcher: &LauncherCommand,
    environment: &ProcessEnvironment,
) -> Result<(InitializeProbe, Vec<String>)> {
    tracing::debug!(
        event_name = "provider_discovery.probe_initialize.start",
        source = "acp-discovery",
        provider = %provider.as_str(),
        executable = %launcher.executable.display(),
        args = ?launcher.args,
        environment_vars = environment.env.len()
    );
    let mut process = spawn_provider_process(provider, launcher, environment)?;
    let request = initialize_request()?;
    send_initialize_request(provider, launcher, &mut process.stdin, &request)?;
    let bundle =
        load_locked_contract_bundle().map_err(|error| contract(provider, error.to_string()))?;
    let request_value = to_value(request).map_err(|error| contract(provider, error.to_string()))?;
    validate_locked_request_envelope(&bundle, &request_value)
        .map_err(|error| contract(provider, error.to_string()))?;
    let capture = read_initialize_response(provider, &process.stdout_rx)?;
    let response = capture.response;
    validate_locked_response_envelope(&bundle, LockedMethod::Initialize, &response)
        .map_err(|error| contract(provider, error.to_string()))?;
    let payload = decode_initialize_response(provider, &response)?;
    let _ = process.child.kill();
    let _ = process.child.wait();
    let stderr_lines = process.stderr_rx.try_iter().collect::<Vec<_>>();
    let diagnostics = build_diagnostics(provider, capture.elapsed_ms, &stderr_lines);

    let probe = (
        InitializeProbe {
            response,
            payload,
            stdout_lines: capture.stdout_lines,
            stderr_lines,
            elapsed_ms: capture.elapsed_ms,
        },
        diagnostics,
    );
    tracing::debug!(
        event_name = "provider_discovery.probe_initialize.finish",
        source = "acp-discovery",
        provider = %provider.as_str(),
        elapsed_ms = probe.0.elapsed_ms,
        stdout_lines = probe.0.stdout_lines.len(),
        stderr_lines = probe.0.stderr_lines.len()
    );
    Ok(probe)
}

fn initialize_request() -> Result<JsonRpcMessage<OutgoingMessage<ClientSide, AgentSide>>> {
    let request = Request {
        id: 1.into(),
        method: Arc::from(AGENT_METHOD_NAMES.initialize),
        params: Some(ClientRequest::InitializeRequest(
            InitializeRequest::new(ProtocolVersion::V1)
                .client_info(Implementation::new("conduit-discovery", "0.5.0")),
        )),
    };
    Ok(JsonRpcMessage::wrap(OutgoingMessage::Request(request)))
}

fn decode_initialize_response(
    provider: ProviderId,
    envelope: &Value,
) -> Result<InitializeResponse> {
    let typed = serde_json::from_value::<JsonRpcMessage<OutgoingMessage<AgentSide, ClientSide>>>(
        envelope.clone(),
    )
    .map_err(|error| contract(provider, error.to_string()))?;
    let JsonRpcMessage { .. } = typed;
    let value =
        envelope
            .get("result")
            .cloned()
            .ok_or_else(|| DiscoveryError::InitializeResponse {
                provider: provider.as_str().to_owned(),
                message: "missing result field".to_owned(),
            })?;

    match serde_json::from_value::<InitializeResponse>(value) {
        Ok(payload) => Ok(payload),
        Err(error) => Err(DiscoveryError::InitializeResponse {
            provider: provider.as_str().to_owned(),
            message: error.to_string(),
        }),
    }
}

fn response_version(provider: ProviderId, response: &InitializeResponse) -> Result<String> {
    let version = response
        .agent_info
        .as_ref()
        .map(|info| info.version.clone())
        .ok_or_else(|| DiscoveryError::InitializeResponse {
            provider: provider.as_str().to_owned(),
            message: "agentInfo was missing".to_owned(),
        })?;
    if version.is_empty() {
        return Err(DiscoveryError::InitializeResponse {
            provider: provider.as_str().to_owned(),
            message: "agentInfo.version was empty".to_owned(),
        });
    }

    Ok(version)
}

fn response_auth_hints(response: &Value) -> Vec<String> {
    response
        .get("result")
        .and_then(|result| result.get("authMethods"))
        .and_then(Value::as_array)
        .map(|methods| {
            methods
                .iter()
                .filter_map(auth_hint_from_value)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn auth_hint_from_value(value: &Value) -> Option<String> {
    let name = value.get("name").and_then(Value::as_str)?;
    let description = value
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or("");
    Some(format!("{name}: {description}").trim().to_owned())
}

fn contract(provider: ProviderId, message: String) -> DiscoveryError {
    DiscoveryError::Contract {
        provider: provider.as_str().to_owned(),
        message,
    }
}
