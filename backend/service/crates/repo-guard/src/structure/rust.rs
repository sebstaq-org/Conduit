//! Rust workspace graph checks for repo structure.

use super::{APPROVED_CRATES, source};
use crate::error::{Error, Result};
use crate::process::capture;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

const PROVIDERS: [&str; 3] = ["provider-claude", "provider-codex", "provider-copilot"];

#[derive(Debug, Deserialize)]
pub(super) struct Metadata {
    pub(super) packages: Vec<Package>,
    pub(super) resolve: Option<Resolve>,
    pub(super) workspace_members: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Resolve {
    pub(super) nodes: Vec<Node>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Node {
    pub(super) id: String,
    pub(super) dependencies: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct Package {
    pub(super) dependencies: Vec<Dependency>,
    pub(super) id: String,
    pub(super) manifest_path: PathBuf,
    pub(super) name: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct Dependency {
    pub(super) name: String,
}

struct Layout {
    names_by_id: HashMap<String, String>,
    packages: Vec<Package>,
}

/// Loads Cargo metadata for the Rust workspace.
pub(super) fn load_metadata(repo_root: &Path) -> Result<Metadata> {
    let raw = capture(
        "cargo",
        &[
            "metadata",
            "--locked",
            "--manifest-path",
            "backend/service/Cargo.toml",
            "--format-version",
            "1",
        ],
        repo_root,
    )?;
    serde_json::from_str(&raw).map_err(|source| Error::Json {
        path: repo_root.join("backend/service/Cargo.toml"),
        source,
    })
}

/// Collects Rust workspace failures against the repo policy.
pub(super) fn collect_workspace_failures(
    repo_root: &Path,
    metadata: &Metadata,
    failures: &mut Vec<String>,
) -> Result<()> {
    let layout = collect_members(repo_root, metadata, failures);
    let Some(resolve) = &metadata.resolve else {
        failures.push("cargo metadata did not include resolve graph data.".to_owned());
        return Ok(());
    };
    let nodes_by_id = resolve
        .nodes
        .iter()
        .map(|node| (node.id.clone(), node))
        .collect::<HashMap<_, _>>();
    let deps_by_crate = build_local_deps(
        &metadata.workspace_members,
        &layout.names_by_id,
        &nodes_by_id,
        failures,
    );

    enforce_isolated_crates(&deps_by_crate, failures);
    enforce_runtime_barriers(&deps_by_crate, failures);
    enforce_provider_rules(&deps_by_crate, failures);
    enforce_session_rules(&deps_by_crate, failures);
    for package in &layout.packages {
        source::collect_failures(repo_root, package, failures)?;
    }

    Ok(())
}

fn collect_members(repo_root: &Path, metadata: &Metadata, failures: &mut Vec<String>) -> Layout {
    let packages_by_id = metadata
        .packages
        .iter()
        .map(|package| (package.id.clone(), package))
        .collect::<HashMap<_, _>>();
    let mut crate_names = HashSet::new();
    let mut names_by_id = HashMap::new();
    let mut packages = Vec::new();

    for member_id in &metadata.workspace_members {
        let Some(package) = packages_by_id.get(member_id) else {
            failures.push(format!(
                "cargo metadata is missing package details for {member_id}."
            ));
            continue;
        };

        let crate_name = register_member(repo_root, package, failures);
        crate_names.insert(crate_name.clone());
        names_by_id.insert(member_id.clone(), crate_name);
        packages.push((*package).clone());
    }

    for approved in APPROVED_CRATES {
        if !crate_names.contains(approved) {
            failures.push(format!(
                "Rust workspace is missing approved crate {approved}."
            ));
        }
    }

    Layout {
        names_by_id,
        packages,
    }
}

fn register_member(repo_root: &Path, package: &Package, failures: &mut Vec<String>) -> String {
    let manifest_directory = package.manifest_path.parent().unwrap_or(repo_root);
    let relative_directory = super::files::relative_path(repo_root, manifest_directory);
    let crate_name = manifest_directory
        .file_name()
        .and_then(std::ffi::OsStr::to_str)
        .unwrap_or_default()
        .to_owned();

    if !relative_directory.starts_with("backend/service/crates/") {
        failures.push(format!(
            "Rust workspace member {} sits outside backend/service/crates/: {}.",
            package.name, relative_directory
        ));
    }
    if !APPROVED_CRATES.contains(&crate_name.as_str()) {
        failures.push(format!(
            "Rust workspace member {} is not an approved crate: {}.",
            package.name, crate_name
        ));
    }

    crate_name
}

fn build_local_deps(
    members: &[String],
    names_by_id: &HashMap<String, String>,
    nodes_by_id: &HashMap<String, &Node>,
    failures: &mut Vec<String>,
) -> HashMap<String, HashSet<String>> {
    let mut deps_by_crate = HashMap::new();
    for member_id in members {
        let Some(crate_name) = names_by_id.get(member_id) else {
            continue;
        };
        let Some(node) = nodes_by_id.get(member_id) else {
            failures.push(format!(
                "cargo metadata is missing resolve node for {crate_name}."
            ));
            continue;
        };

        let deps = node
            .dependencies
            .iter()
            .filter_map(|dependency_id| names_by_id.get(dependency_id))
            .cloned()
            .collect::<HashSet<_>>();
        deps_by_crate.insert(crate_name.clone(), deps);
    }

    deps_by_crate
}

fn enforce_isolated_crates(
    deps_by_crate: &HashMap<String, HashSet<String>>,
    failures: &mut Vec<String>,
) {
    for crate_name in ["acp-contracts", "repo-guard"] {
        if let Some(local_deps) = deps_by_crate.get(crate_name)
            && !local_deps.is_empty()
        {
            let mut dependencies = local_deps.iter().cloned().collect::<Vec<_>>();
            dependencies.sort();
            failures.push(format!(
                "{crate_name} may not depend on local crates: {}.",
                dependencies.join(", ")
            ));
        }
    }
}

fn enforce_runtime_barriers(
    deps_by_crate: &HashMap<String, HashSet<String>>,
    failures: &mut Vec<String>,
) {
    for (crate_name, local_deps) in deps_by_crate {
        for forbidden in ["service-bin", "repo-guard"] {
            if local_deps.contains(forbidden) {
                failures.push(format!("{crate_name} may not depend on {forbidden}."));
            }
        }
    }
}

fn enforce_provider_rules(
    deps_by_crate: &HashMap<String, HashSet<String>>,
    failures: &mut Vec<String>,
) {
    for provider in PROVIDERS {
        let local_deps = deps_by_crate.get(provider).cloned().unwrap_or_default();
        for forbidden in ["app-api", "session-store"] {
            if local_deps.contains(forbidden) {
                failures.push(format!("{provider} may not depend on {forbidden}."));
            }
        }
        for sibling in PROVIDERS {
            if sibling != provider && local_deps.contains(sibling) {
                failures.push(format!("{provider} may not depend on {sibling}."));
            }
        }
    }
}

fn enforce_session_rules(
    deps_by_crate: &HashMap<String, HashSet<String>>,
    failures: &mut Vec<String>,
) {
    if let Some(local_deps) = deps_by_crate.get("app-api") {
        for provider in PROVIDERS {
            if local_deps.contains(provider) {
                failures.push(format!("app-api may not depend on {provider}."));
            }
        }
    }
    if let Some(local_deps) = deps_by_crate.get("session-store") {
        for forbidden in [
            "app-api",
            "provider-claude",
            "provider-codex",
            "provider-copilot",
        ] {
            if local_deps.contains(forbidden) {
                failures.push(format!("session-store may not depend on {forbidden}."));
            }
        }
    }
}
