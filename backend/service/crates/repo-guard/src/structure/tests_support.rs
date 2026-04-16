//! Shared test fixtures for structure enforcement.

use super::rust::{Dependency, Metadata, Node, Package, Resolve};
use crate::error::{Error, Result};
use serde_json::json;
use std::fs::{create_dir_all, write};
use std::path::{Path, PathBuf};
use tempfile::TempDir;

const APPROVED_CRATES: [&str; 11] = [
    "acp-contracts",
    "acp-core",
    "acp-discovery",
    "app-api",
    "provider-claude",
    "provider-codex",
    "provider-copilot",
    "repo-guard",
    "service-bin",
    "service-runtime",
    "session-store",
];

pub(super) struct Fixture {
    _tempdir: TempDir,
    pub(super) metadata: Metadata,
    pub(super) repo_root: PathBuf,
}

pub(super) fn fixture() -> Result<Fixture> {
    let tempdir = TempDir::new().map_err(|source| Error::io(None, source))?;
    let repo_root = tempdir.path().to_path_buf();
    create_roots(&repo_root)?;
    write_workspace_packages(&repo_root)?;
    write_crates(&repo_root)?;
    write_support_files(&repo_root)?;

    Ok(Fixture {
        _tempdir: tempdir,
        metadata: metadata(&repo_root),
        repo_root,
    })
}

pub(super) fn write_file(path: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        create_dir_all(parent).map_err(|source| Error::io(Some(parent.to_path_buf()), source))?;
    }

    write(path, contents).map_err(|source| Error::io(Some(path.to_path_buf()), source))
}

pub(super) fn ensure(condition: bool, message: &str) -> Result<()> {
    if condition {
        return Ok(());
    }

    Err(Error::invalid_args(message))
}

pub(super) fn ensure_contains(failures: &[String], needle: &str) -> Result<()> {
    ensure_any(
        failures,
        |failure| failure == needle,
        &format!("expected failure: {needle}"),
    )
}

pub(super) fn ensure_any(
    failures: &[String],
    predicate: impl Fn(&str) -> bool,
    message: &str,
) -> Result<()> {
    if failures.iter().any(|failure| predicate(failure)) {
        return Ok(());
    }

    Err(Error::invalid_args(message))
}

fn create_roots(repo_root: &Path) -> Result<()> {
    for relative in [
        "apps/desktop/src",
        "apps/frontend/src",
        "artifacts/automated",
        "artifacts/manual",
        "backend/service/crates",
        "backend/service/testdata/failures",
        "backend/service/testdata/golden",
        "backend/service/testdata/providers",
        "docs",
        "packages/app-client/src",
        "packages/app-core/src",
        "packages/app-protocol/src",
        "packages/design-system-tokens/src",
        "packages/session-client/src",
        "scripts",
        "vendor/agent-client-protocol",
    ] {
        let path = repo_root.join(relative);
        create_dir_all(&path).map_err(|source| Error::io(Some(path), source))?;
    }

    Ok(())
}

fn write_workspace_packages(repo_root: &Path) -> Result<()> {
    for (name, root) in workspace_packages() {
        let manifest_path = repo_root.join(root).join("package.json");
        let manifest = serde_json::to_string_pretty(&json!({
            "name": name,
            "private": true,
            "version": "0.5.0"
        }))
        .map_err(|source| Error::Json {
            path: manifest_path.clone(),
            source,
        })?;
        write_file(&manifest_path, &manifest)?;
        write_file(&repo_root.join(root).join("src/index.ts"), "export {};\n")?;
    }

    Ok(())
}

fn write_crates(repo_root: &Path) -> Result<()> {
    for crate_name in APPROVED_CRATES {
        let crate_root = repo_root.join("backend/service/crates").join(crate_name);
        let entry = if crate_name == "service-bin" {
            "main.rs"
        } else {
            "lib.rs"
        };
        create_dir_all(crate_root.join("src"))
            .map_err(|source| Error::io(Some(crate_root.join("src")), source))?;
        write_file(&crate_root.join("Cargo.toml"), &crate_manifest(crate_name))?;
        write_file(
            &crate_root.join("src").join(entry),
            "//! Crate docs.\n\nfn local_stub() {}\n",
        )?;
    }

    Ok(())
}

fn write_support_files(repo_root: &Path) -> Result<()> {
    for relative in [
        "artifacts/automated/.gitkeep",
        "artifacts/manual/.gitkeep",
        "backend/service/testdata/failures/.gitkeep",
        "backend/service/testdata/golden/.gitkeep",
        "backend/service/testdata/providers/.gitkeep",
    ] {
        write_file(&repo_root.join(relative), "")?;
    }
    write_file(
        &repo_root.join("vendor/agent-client-protocol/README.md"),
        "# vendor\n",
    )
}

fn workspace_packages() -> [(&'static str, &'static str); 7] {
    [
        ("@conduit/desktop", "apps/desktop"),
        ("@conduit/frontend", "apps/frontend"),
        ("@conduit/app-client", "packages/app-client"),
        ("@conduit/app-core", "packages/app-core"),
        ("@conduit/app-protocol", "packages/app-protocol"),
        (
            "@conduit/design-system-tokens",
            "packages/design-system-tokens",
        ),
        ("@conduit/session-client", "packages/session-client"),
    ]
}

fn crate_manifest(crate_name: &str) -> String {
    format!(
        "[package]\nname = \"{crate_name}\"\nversion.workspace = true\nedition.workspace = true\nrust-version.workspace = true\n\n[lints]\nworkspace = true\n"
    )
}

fn metadata(repo_root: &Path) -> Metadata {
    let local_deps = [
        ("acp-contracts", Vec::<&str>::new()),
        ("acp-core", Vec::<&str>::new()),
        ("acp-discovery", Vec::<&str>::new()),
        ("app-api", vec!["acp-contracts", "acp-core"]),
        ("provider-claude", Vec::<&str>::new()),
        ("provider-codex", Vec::<&str>::new()),
        ("provider-copilot", Vec::<&str>::new()),
        ("repo-guard", vec!["tracing", "tracing-subscriber"]),
        (
            "service-bin",
            vec![
                "acp-discovery",
                "app-api",
                "provider-claude",
                "provider-codex",
                "provider-copilot",
                "session-store",
                "tracing",
                "tracing-subscriber",
            ],
        ),
        (
            "service-runtime",
            vec!["acp-core", "acp-discovery", "app-api", "session-store"],
        ),
        ("session-store", vec!["acp-core", "acp-discovery"]),
    ];

    Metadata {
        packages: local_deps
            .iter()
            .map(|(name, deps)| Package {
                dependencies: deps
                    .iter()
                    .map(|dep| Dependency {
                        name: (*dep).to_owned(),
                    })
                    .collect(),
                id: (*name).to_owned(),
                manifest_path: repo_root
                    .join("backend/service/crates")
                    .join(name)
                    .join("Cargo.toml"),
                name: (*name).to_owned(),
            })
            .collect(),
        resolve: Some(Resolve {
            nodes: local_deps
                .iter()
                .map(|(name, deps)| Node {
                    id: (*name).to_owned(),
                    dependencies: deps.iter().map(|dep| (*dep).to_owned()).collect(),
                })
                .collect(),
        }),
        workspace_members: APPROVED_CRATES
            .iter()
            .map(|name| (*name).to_owned())
            .collect(),
    }
}
