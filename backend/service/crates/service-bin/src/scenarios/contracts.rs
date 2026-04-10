//! Contract artifact scenario.

use crate::artifact::write_contract_artifacts;
use crate::error::{Result, ServiceError};
use crate::support::command_text;
use acp_contracts::{LOCKED_ACP_METHODS, load_locked_contract_bundle};
use std::fs::read_to_string;
use std::path::Path;

/// Writes Part 1 contract lock artifacts.
///
/// # Errors
///
/// Returns an error when the locked bundle cannot be loaded or artifact files
/// cannot be written.
pub(crate) fn run(root: &Path, args: &[String]) -> Result<()> {
    let bundle = load_locked_contract_bundle()?;
    let vendor_root = bundle.repo_root.join("vendor/agent-client-protocol");
    let manifest_path = vendor_root.join("manifest.toml");
    let manifest_copy =
        read_to_string(&manifest_path).map_err(|source| ServiceError::WriteArtifact {
            path: manifest_path,
            source,
        })?;
    let summary = format!(
        "# Part 1\n\nPinned tag: `{}`\n\nLocked methods: {}\n",
        bundle.manifest.upstream.tag,
        LOCKED_ACP_METHODS
            .iter()
            .map(|method| format!("`{}`", method.method_name()))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let schema_meta_check = format!(
        "schema_sha256={}\nmeta_sha256={}\ncommit={}\n",
        bundle.manifest.files.schema.sha256,
        bundle.manifest.files.meta.sha256,
        bundle.manifest.upstream.commit
    );
    write_contract_artifacts(
        root,
        &command_text(args),
        &summary,
        &manifest_copy,
        &schema_meta_check,
    )
}
