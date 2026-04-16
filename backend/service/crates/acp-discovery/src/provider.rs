//! Static official ACP launcher definitions.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::path::PathBuf;
use std::str::FromStr;

/// The three providers supported by Conduit Phase 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    /// Anthropic Claude via the official ACP adapter.
    Claude,
    /// GitHub Copilot via the official ACP adapter.
    Copilot,
    /// OpenAI Codex via the official ACP adapter.
    Codex,
}

impl ProviderId {
    /// Returns the stable wire identifier for this provider.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Copilot => "copilot",
            Self::Codex => "codex",
        }
    }
}

impl Display for ProviderId {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for ProviderId {
    type Err = &'static str;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "claude" => Ok(Self::Claude),
            "copilot" => Ok(Self::Copilot),
            "codex" => Ok(Self::Codex),
            _ => Err("provider must be one of: claude, copilot, codex"),
        }
    }
}

/// The exact launcher command Conduit is allowed to run for a provider.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct LauncherCommand {
    /// The resolved executable path after discovery.
    pub executable: PathBuf,
    /// The actual argv that Conduit will pass after the executable.
    pub args: Vec<String>,
    /// The human-readable command string fixed by policy.
    pub display: String,
}

/// The fixed provider launcher definition for Conduit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderLauncher {
    /// The provider identifier.
    pub provider: ProviderId,
    /// The executable name that must resolve on `PATH`.
    pub program: &'static str,
    /// The exact provider args Conduit is allowed to add.
    pub args: &'static [&'static str],
    /// The human-readable launcher command.
    pub display: &'static str,
}

/// Returns the exact launcher allowed for a provider.
#[must_use]
pub const fn provider_launcher(provider: ProviderId) -> ProviderLauncher {
    match provider {
        ProviderId::Claude => ProviderLauncher {
            provider,
            program: "claude-agent-acp",
            args: &[],
            display: "claude-agent-acp",
        },
        ProviderId::Copilot => ProviderLauncher {
            provider,
            program: "copilot",
            args: &["--acp", "--allow-all", "--no-color", "--no-auto-update"],
            display: "copilot --acp --allow-all --no-color --no-auto-update",
        },
        ProviderId::Codex => ProviderLauncher {
            provider,
            program: "codex-acp",
            args: &[],
            display: "codex-acp",
        },
    }
}
