//! TypeScript workspace checks for repo structure.

use super::files::{relative_path, walk_files};
use super::js_runtime;
use crate::error::{Error, Result};
use regex::Regex;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum Kind {
    App,
    Package,
}

#[derive(Debug)]
pub(super) struct Unit {
    pub(super) kind: Kind,
    pub(super) name: String,
    pub(super) root: PathBuf,
    dependencies: HashSet<String>,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    name: String,
    dependencies: Option<HashMap<String, String>>,
    #[serde(rename = "devDependencies")]
    dev_dependencies: Option<HashMap<String, String>>,
    #[serde(rename = "optionalDependencies")]
    optional_dependencies: Option<HashMap<String, String>>,
    #[serde(rename = "peerDependencies")]
    peer_dependencies: Option<HashMap<String, String>>,
}

struct ImportCheck<'a> {
    failures: &'a mut Vec<String>,
    indices: &'a HashMap<String, usize>,
    repo_root: &'a Path,
    units: &'a [Unit],
}

/// Reads a workspace unit manifest from the repository.
pub(super) fn read_unit(repo_root: &Path, kind: Kind, relative_root: &str) -> Result<Unit> {
    let root = repo_root.join(relative_root);
    let manifest_path = root.join("package.json");
    let manifest_contents = read_to_string(&manifest_path)
        .map_err(|source| Error::io(Some(manifest_path.clone()), source))?;
    let manifest: Manifest =
        serde_json::from_str(&manifest_contents).map_err(|source| Error::Json {
            path: manifest_path,
            source,
        })?;
    let dependencies = collect_dependencies(&manifest);
    let name = manifest.name;

    Ok(Unit {
        kind,
        name,
        root,
        dependencies,
    })
}

/// Checks that workspace imports respect package and app boundaries.
pub(super) fn check_workspace_imports(
    repo_root: &Path,
    units: &[Unit],
    indices: &HashMap<String, usize>,
    failures: &mut Vec<String>,
) -> Result<()> {
    let mut check = ImportCheck {
        failures,
        indices,
        repo_root,
        units,
    };

    for unit in units {
        for file in source_files(unit)? {
            let source =
                read_to_string(&file).map_err(|error| Error::io(Some(file.clone()), error))?;
            check.record_session_contract_wire_export(unit, &file, &source);
            for specifier in import_specifiers(&source)? {
                check.record(unit, &file, &specifier);
            }
        }
    }

    Ok(())
}

impl ImportCheck<'_> {
    fn record(&mut self, unit: &Unit, file: &Path, specifier: &str) {
        if self.record_relative_escape(unit, file, specifier)
            || self.record_repo_path(file, specifier)
            || self.record_frontend_runtime_violation(unit, file, specifier)
            || self.record_app_protocol_violation(unit, file, specifier)
        {
            return;
        }
        if !specifier.starts_with("@conduit/") {
            return;
        }

        let Some(package_name) = workspace_package(specifier) else {
            return;
        };
        let Some(target_index) = self.indices.get(&package_name).copied() else {
            self.failures.push(format!(
                "{} imports unknown workspace package {}.",
                relative_path(self.repo_root, file),
                specifier
            ));
            return;
        };

        let target = &self.units[target_index];
        if unit.name == target.name {
            return;
        }
        if self.record_boundary_violation(unit, target, file, specifier) {
            return;
        }
        if !unit.dependencies.contains(&package_name) {
            self.failures.push(format!(
                "{} imports {} without declaring {}.",
                relative_path(self.repo_root, file),
                specifier,
                package_name
            ));
        }
    }

    fn record_relative_escape(&mut self, unit: &Unit, file: &Path, specifier: &str) -> bool {
        if !specifier.starts_with('.') {
            return false;
        }

        let resolved = file.parent().unwrap_or(unit.root.as_path()).join(specifier);
        let relative = relative_path(&unit.root, &resolved);
        if relative.starts_with("..") {
            self.failures.push(format!(
                "{} reaches outside {} via {}.",
                relative_path(self.repo_root, file),
                unit.name,
                specifier
            ));
        }

        true
    }

    fn record_repo_path(&mut self, file: &Path, specifier: &str) -> bool {
        if !is_repo_path(specifier) {
            return false;
        }

        self.failures.push(format!(
            "{} uses repo-path import {}; use package boundaries instead.",
            relative_path(self.repo_root, file),
            specifier
        ));
        true
    }

    fn record_boundary_violation(
        &mut self,
        unit: &Unit,
        target: &Unit,
        file: &Path,
        specifier: &str,
    ) -> bool {
        let message = match (unit.kind, target.kind) {
            (Kind::App, Kind::App) => Some("crosses app boundary"),
            (Kind::Package, Kind::App) => Some("imports app code"),
            _ => None,
        };
        let Some(message) = message else {
            return false;
        };

        self.failures.push(format!(
            "{} {} via {}.",
            relative_path(self.repo_root, file),
            message,
            specifier
        ));
        true
    }

    fn record_frontend_runtime_violation(
        &mut self,
        unit: &Unit,
        file: &Path,
        specifier: &str,
    ) -> bool {
        let message = js_runtime::violation_message(&unit.name, specifier);
        let Some(message) = message else {
            return false;
        };

        self.failures.push(format!(
            "{} {message} via {}.",
            relative_path(self.repo_root, file),
            specifier
        ));
        true
    }

    fn record_app_protocol_violation(&mut self, unit: &Unit, file: &Path, specifier: &str) -> bool {
        if workspace_package(specifier).as_deref() != Some("@conduit/app-protocol") {
            return false;
        }
        if unit.name == "@conduit/app-protocol"
            || unit.name == "@conduit/session-client"
            || is_frontend_app_protocol_adapter(self.repo_root, unit, file)
        {
            return false;
        }

        self.failures.push(format!(
            "{} imports @conduit/app-protocol outside the client/adaptation boundary.",
            relative_path(self.repo_root, file),
        ));
        true
    }

    fn record_session_contract_wire_export(&mut self, unit: &Unit, file: &Path, source: &str) {
        if unit.name != "@conduit/session-contracts" {
            return;
        }
        for symbol in FORBIDDEN_SESSION_CONTRACT_SYMBOLS {
            if source.contains(symbol) {
                self.failures.push(format!(
                    "{} defines backend-to-frontend wire contract {symbol}; use @conduit/app-protocol in client/adaptation layers instead.",
                    relative_path(self.repo_root, file),
                ));
            }
        }
    }
}

const FORBIDDEN_SESSION_CONTRACT_SYMBOLS: [&str; 6] = [
    "RuntimeEventSchema",
    "RuntimeEventKind",
    "RuntimeEvent",
    "ServerEventFrame",
    "ServerFrame",
    "ServerResponseFrame",
];

fn collect_dependencies(manifest: &Manifest) -> HashSet<String> {
    [
        manifest.dependencies.as_ref(),
        manifest.dev_dependencies.as_ref(),
        manifest.optional_dependencies.as_ref(),
        manifest.peer_dependencies.as_ref(),
    ]
    .into_iter()
    .flatten()
    .flat_map(|deps| deps.keys().cloned())
    .collect()
}

fn source_files(unit: &Unit) -> Result<Vec<PathBuf>> {
    Ok(walk_files(&unit.root.join("src"))?
        .into_iter()
        .filter(|path| {
            matches!(
                path.extension().and_then(std::ffi::OsStr::to_str),
                Some("ts" | "tsx")
            )
        })
        .collect())
}

fn import_specifiers(source: &str) -> Result<Vec<String>> {
    Ok(import_regex()?
        .captures_iter(source)
        .filter_map(|captures| captures.get(1).or_else(|| captures.get(2)))
        .map(|capture| capture.as_str().to_owned())
        .collect())
}

fn import_regex() -> Result<&'static Regex> {
    static REGEX: OnceLock<std::result::Result<Regex, String>> = OnceLock::new();
    REGEX
        .get_or_init(|| {
            Regex::new(
                r#"(?:import|export)\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)"#,
            )
            .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(|error| Error::invalid_args(&format!("invalid import regex: {error}")))
}

fn workspace_package(specifier: &str) -> Option<String> {
    let mut parts = specifier.split('/');
    match (parts.next(), parts.next()) {
        (Some(scope), Some(name)) => Some(format!("{scope}/{name}")),
        _ => None,
    }
}

fn is_repo_path(specifier: &str) -> bool {
    specifier.starts_with('/')
        || specifier.starts_with("apps/")
        || specifier.starts_with("packages/")
        || specifier.starts_with("backend/")
        || specifier.starts_with("vendor/")
        || specifier.starts_with("artifacts/")
}

fn is_frontend_app_protocol_adapter(repo_root: &Path, unit: &Unit, file: &Path) -> bool {
    if unit.name != "@conduit/frontend" {
        return false;
    }
    relative_path(repo_root, file).starts_with("apps/frontend/src/app-state/protocol/")
}
