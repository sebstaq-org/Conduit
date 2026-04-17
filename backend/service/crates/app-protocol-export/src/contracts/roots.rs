use super::{ContractError, merge_schema};
use acp_core as conduit_core;
use agent_client_protocol_schema as acp;
use serde_json::Value;
use service_runtime::consumer_protocol as conduit;
use std::collections::BTreeMap;

pub(crate) const ROOT_DEFINITIONS: [&str; 26] = [
    "ContentBlock",
    "ToolCallUpdate",
    "Plan",
    "AvailableCommandsUpdate",
    "CurrentModeUpdate",
    "ConfigOptionUpdate",
    "SessionInfoUpdate",
    "SessionUpdate",
    "ConduitServerFrame",
    "ConduitConsumerResponse",
    "ConduitRuntimeEvent",
    "ConduitInteractionOption",
    "ConduitInteractionRequestData",
    "ConduitInteractionResolutionData",
    "ConduitTerminalPlanData",
    "ConduitSessionHistoryWindow",
    "ConduitSessionNewResult",
    "ConduitSessionOpenResult",
    "ConduitSessionSetConfigOptionResult",
    "ConduitProjectListView",
    "ConduitProjectSuggestionsView",
    "ConduitGlobalSettingsView",
    "ConduitSessionGroupsView",
    "ConduitProvidersConfigSnapshotResult",
    "ConduitSessionsWatchResult",
    "ConduitSessionWatchResult",
];

macro_rules! merge_backend_schema {
    ($definitions:expr, $contract:ty, $name:literal) => {
        merge_schema::<$contract>($name, $definitions)?;
    };
}

pub(crate) fn merge_backend_types(
    definitions: &mut BTreeMap<String, Value>,
) -> Result<(), ContractError> {
    merge_acp_types(definitions)?;
    merge_conduit_types(definitions)?;
    Ok(())
}

fn merge_acp_types(definitions: &mut BTreeMap<String, Value>) -> Result<(), ContractError> {
    merge_backend_schema!(definitions, acp::ContentBlock, "ContentBlock");
    merge_backend_schema!(definitions, acp::ToolCallUpdate, "ToolCallUpdate");
    merge_backend_schema!(definitions, acp::Plan, "Plan");
    merge_backend_schema!(
        definitions,
        acp::AvailableCommandsUpdate,
        "AvailableCommandsUpdate"
    );
    merge_backend_schema!(definitions, acp::CurrentModeUpdate, "CurrentModeUpdate");
    merge_backend_schema!(definitions, acp::ConfigOptionUpdate, "ConfigOptionUpdate");
    merge_backend_schema!(definitions, acp::SessionInfoUpdate, "SessionInfoUpdate");
    merge_backend_schema!(definitions, acp::SessionUpdate, "SessionUpdate");
    Ok(())
}

fn merge_conduit_types(definitions: &mut BTreeMap<String, Value>) -> Result<(), ContractError> {
    merge_backend_schema!(
        definitions,
        conduit::ConduitServerFrame,
        "ConduitServerFrame"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitConsumerResponse,
        "ConduitConsumerResponse"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitRuntimeEvent,
        "ConduitRuntimeEvent"
    );
    merge_backend_schema!(
        definitions,
        conduit_core::ConduitInteractionOption,
        "ConduitInteractionOption"
    );
    merge_backend_schema!(
        definitions,
        conduit_core::ConduitInteractionRequestData,
        "ConduitInteractionRequestData"
    );
    merge_backend_schema!(
        definitions,
        conduit_core::ConduitInteractionResolutionData,
        "ConduitInteractionResolutionData"
    );
    merge_backend_schema!(
        definitions,
        conduit_core::ConduitTerminalPlanData,
        "ConduitTerminalPlanData"
    );
    merge_session_result_types(definitions)?;
    merge_project_result_types(definitions)?;
    Ok(())
}

fn merge_session_result_types(
    definitions: &mut BTreeMap<String, Value>,
) -> Result<(), ContractError> {
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionHistoryWindow,
        "ConduitSessionHistoryWindow"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionNewResult,
        "ConduitSessionNewResult"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionOpenResult,
        "ConduitSessionOpenResult"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionSetConfigOptionResult,
        "ConduitSessionSetConfigOptionResult"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitProvidersConfigSnapshotResult,
        "ConduitProvidersConfigSnapshotResult"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionsWatchResult,
        "ConduitSessionsWatchResult"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionWatchResult,
        "ConduitSessionWatchResult"
    );
    Ok(())
}

fn merge_project_result_types(
    definitions: &mut BTreeMap<String, Value>,
) -> Result<(), ContractError> {
    merge_backend_schema!(
        definitions,
        conduit::ConduitProjectListView,
        "ConduitProjectListView"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitProjectSuggestionsView,
        "ConduitProjectSuggestionsView"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitGlobalSettingsView,
        "ConduitGlobalSettingsView"
    );
    merge_backend_schema!(
        definitions,
        conduit::ConduitSessionGroupsView,
        "ConduitSessionGroupsView"
    );
    Ok(())
}
