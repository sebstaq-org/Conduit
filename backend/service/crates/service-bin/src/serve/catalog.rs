//! Static service catalog endpoint.

use axum::Json;
use serde_json::json;

const CATALOG_COMMANDS: [&str; 21] = [
    "initialize",
    "session/new",
    "session/set_config_option",
    "session/prompt",
    "session/respond_interaction",
    "session/cancel",
    "provider/disconnect",
    "projects/add",
    "projects/list",
    "projects/remove",
    "projects/suggestions",
    "projects/update",
    "settings/get",
    "settings/update",
    "presence/update",
    "sessions/grouped",
    "sessions/watch",
    "providers/config_snapshot",
    "session/open",
    "session/history",
    "session/watch",
];

pub(super) async fn catalog() -> Json<serde_json::Value> {
    Json(json!({
        "providers": ["claude", "copilot", "codex"],
        "commands": CATALOG_COMMANDS,
    }))
}
