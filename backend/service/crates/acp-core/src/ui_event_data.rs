//! UI-consumed event data produced by the ACP host boundary.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One selectable interaction option shown by the UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitInteractionOption {
    /// Provider option kind.
    pub kind: String,
    /// User-facing option label.
    pub name: String,
    /// Stable option id returned to the provider.
    pub option_id: String,
}

impl ConduitInteractionOption {
    /// Creates one UI interaction option.
    #[must_use]
    pub fn new(kind: String, name: String, option_id: String) -> Self {
        Self {
            kind,
            name,
            option_id,
        }
    }
}

/// UI-consumed transcript event data for one pending interaction request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitInteractionRequestData {
    /// Event discriminator carried inside the transcript event payload.
    #[schemars(extend("const" = "interaction_request"))]
    pub session_update: String,
    /// Stable interaction id.
    pub interaction_id: String,
    /// ACP tool call id associated with the interaction.
    pub tool_call_id: String,
    /// Provider request type.
    #[schemars(extend("const" = "request_user_input"))]
    pub request_type: String,
    /// Provider question id.
    pub question_id: String,
    /// Optional question header.
    pub question_header: Option<String>,
    /// User-facing question text.
    pub question: String,
    /// Whether the interaction accepts freeform text.
    pub is_other: bool,
    /// Selectable provider options.
    pub options: Vec<ConduitInteractionOption>,
    /// Current request status.
    #[schemars(extend("const" = "pending"))]
    pub status: String,
    /// Raw provider input retained for diagnostics only.
    pub raw_input: Value,
}

impl ConduitInteractionRequestData {
    /// Creates one pending interaction request event payload.
    #[must_use]
    pub fn new(input: ConduitInteractionRequestInput) -> Self {
        Self {
            session_update: "interaction_request".to_owned(),
            interaction_id: input.interaction_id,
            tool_call_id: input.tool_call_id,
            request_type: "request_user_input".to_owned(),
            question_id: input.question_id,
            question_header: input.question_header,
            question: input.question,
            is_other: input.is_other,
            options: input.options,
            status: "pending".to_owned(),
            raw_input: input.raw_input,
        }
    }
}

/// Constructor input for one pending interaction request event payload.
#[derive(Debug, Clone, PartialEq)]
pub struct ConduitInteractionRequestInput {
    /// Stable interaction id.
    pub interaction_id: String,
    /// ACP tool call id associated with the interaction.
    pub tool_call_id: String,
    /// Provider question id.
    pub question_id: String,
    /// Optional question header.
    pub question_header: Option<String>,
    /// User-facing question text.
    pub question: String,
    /// Whether the interaction accepts freeform text.
    pub is_other: bool,
    /// Selectable provider options.
    pub options: Vec<ConduitInteractionOption>,
    /// Raw provider input retained for diagnostics only.
    pub raw_input: Value,
}

/// Terminal interaction status reported after a provider resolves the request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ConduitInteractionResolutionStatus {
    /// The provider completed the interaction.
    Resolved,
    /// The provider cancelled the interaction.
    Cancelled,
    /// The provider failed the interaction.
    Failed,
}

/// UI-consumed transcript event data for one resolved interaction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitInteractionResolutionData {
    /// Event discriminator carried inside the transcript event payload.
    #[schemars(extend("const" = "interaction_resolution"))]
    pub session_update: String,
    /// Stable interaction id.
    pub interaction_id: String,
    /// ACP tool call id associated with the interaction.
    pub tool_call_id: String,
    /// Terminal interaction status.
    pub status: ConduitInteractionResolutionStatus,
    /// Raw provider output retained for diagnostics only.
    pub raw_output: Value,
}

impl ConduitInteractionResolutionData {
    /// Creates one terminal interaction resolution event payload.
    #[must_use]
    pub fn new(
        interaction_id: String,
        tool_call_id: String,
        status: ConduitInteractionResolutionStatus,
        raw_output: Value,
    ) -> Self {
        Self {
            session_update: "interaction_resolution".to_owned(),
            interaction_id,
            tool_call_id,
            status,
            raw_output,
        }
    }
}

/// UI-consumed transcript event data for one Codex terminal plan decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitTerminalPlanData {
    /// Event discriminator carried inside the transcript event payload.
    #[schemars(extend("const" = "terminal_plan"))]
    pub session_update: String,
    /// Stable interaction id for the plan decision.
    pub interaction_id: String,
    /// Codex turn item id.
    pub item_id: String,
    /// Markdown plan text.
    pub plan_text: String,
    /// Internal normalized source.
    #[schemars(extend("const" = "codex.terminalPlan"))]
    pub source: String,
    /// Codex provider source marker.
    pub provider_source: String,
    /// Current plan decision status.
    #[schemars(extend("const" = "pending"))]
    pub status: String,
    /// Optional Codex turn id.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codex_turn_id: Option<String>,
    /// Optional Codex thread id.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
}

impl ConduitTerminalPlanData {
    /// Creates one pending terminal plan event payload.
    #[must_use]
    pub fn new(
        item_id: String,
        plan_text: String,
        provider_source: String,
        codex_turn_id: Option<String>,
        thread_id: Option<String>,
    ) -> Self {
        Self {
            session_update: "terminal_plan".to_owned(),
            interaction_id: format!("terminal-plan:{item_id}"),
            item_id,
            plan_text,
            source: "codex.terminalPlan".to_owned(),
            provider_source,
            status: "pending".to_owned(),
            codex_turn_id,
            thread_id,
        }
    }
}
