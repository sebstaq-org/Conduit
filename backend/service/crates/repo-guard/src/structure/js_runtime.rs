//! Frontend runtime import boundary checks.

pub(super) fn violation_message(
    unit_name: &str,
    relative_file: &str,
    specifier: &str,
) -> Option<&'static str> {
    if specifier == "@conduit/app-protocol" {
        let allowed = match unit_name {
            "@conduit/app-client" | "@conduit/session-client" => true,
            "@conduit/frontend" => relative_file.starts_with("apps/frontend/src/app-state/"),
            _ => false,
        };
        if !allowed {
            return Some("imports protocol boundary outside an approved adaptation layer");
        }
    }

    match unit_name {
        "@conduit/app-client" | "@conduit/app-core" | "@conduit/design-system-tokens" => {
            is_frontend_runtime(specifier).then_some("imports forbidden framework or shell runtime")
        }
        _ => None,
    }
}

fn is_frontend_runtime(specifier: &str) -> bool {
    is_react_runtime(specifier)
        || is_desktop_runtime(specifier)
        || is_mobile_runtime(specifier)
        || is_shell_runtime(specifier)
}

fn is_react_runtime(specifier: &str) -> bool {
    specifier == "react" || specifier.starts_with("react/")
}

fn is_desktop_runtime(specifier: &str) -> bool {
    specifier == "react-dom" || specifier.starts_with("react-dom/")
}

fn is_mobile_runtime(specifier: &str) -> bool {
    specifier == "react-native" || specifier.starts_with("react-native/")
}

fn is_shell_runtime(specifier: &str) -> bool {
    specifier == "electron"
        || specifier.starts_with("electron/")
        || specifier == "expo"
        || specifier.starts_with("expo/")
        || specifier == "expo-router"
        || specifier.starts_with("expo-router/")
}
