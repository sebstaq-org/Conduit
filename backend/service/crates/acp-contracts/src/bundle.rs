//! Loading for the vendored ACP schema bundle.

use crate::error::{Error, Result};
use jsonschema::Validator;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};

const ACP_VENDOR_ROOT_ENV: &str = "CONDUIT_ACP_VENDOR_ROOT";

/// The pinned upstream metadata for the vendored ACP bundle.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct VendorManifest {
    /// The pinned upstream source information.
    pub upstream: UpstreamSource,
    /// The pinned schema bundle metadata.
    pub bundle: BundleMetadata,
    /// The vendored files that must match the recorded checksums.
    pub files: VendoredFiles,
}

/// The upstream source pinned by Conduit.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct UpstreamSource {
    /// The upstream repository URL.
    pub repository: String,
    /// The pinned tag.
    pub tag: String,
    /// The pinned commit SHA.
    pub commit: String,
}

/// Version metadata for the vendored ACP schema bundle.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct BundleMetadata {
    /// The ACP Rust crate name used for typed decoding.
    pub rust_crate: String,
    /// The pinned ACP Rust crate version.
    pub rust_crate_version: String,
    /// The protocol version expected from the bundle.
    pub protocol_version: u64,
}

/// Vendored file metadata.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct VendoredFiles {
    /// The pinned schema file metadata.
    pub schema: VendoredFile,
    /// The pinned meta file metadata.
    pub meta: VendoredFile,
}

/// A vendored file path plus checksum information.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct VendoredFile {
    /// The repository-relative file path.
    pub path: String,
    /// The upstream Git blob SHA.
    pub upstream_blob_sha: String,
    /// The expected SHA-256 checksum.
    pub sha256: String,
}

/// The loaded ACP vendor bundle.
#[derive(Debug)]
pub struct ContractBundle {
    /// The repository root used to load the bundle.
    pub repo_root: PathBuf,
    /// The parsed vendor manifest.
    pub manifest: VendorManifest,
    /// The parsed ACP JSON schema.
    pub schema: Value,
    /// The parsed ACP method metadata.
    pub meta: Value,
    /// The compiled JSON schema validator.
    pub validator: Validator,
}

struct ContractPaths {
    repo_root: PathBuf,
    vendor_root: PathBuf,
}

/// Loads the pinned ACP vendor bundle from the repository.
///
/// # Errors
///
/// Returns an error when the repository root cannot be resolved, the vendored
/// manifest or schema files cannot be read or parsed, or the vendored bundle
/// checksums no longer match the pinned manifest.
pub fn load_contract_bundle() -> Result<ContractBundle> {
    tracing::debug!(
        event_name = "contract_bundle.load.start",
        source = "acp-contracts"
    );
    let paths = contract_paths()?;
    let repo_root = paths.repo_root;
    let vendor_root = paths.vendor_root;
    let manifest_path = vendor_root.join("manifest.toml");
    let manifest_contents = read_utf8(&manifest_path)?;
    let manifest: VendorManifest =
        toml::from_str(&manifest_contents).map_err(|source| Error::Toml {
            path: manifest_path.clone(),
            source,
        })?;

    let schema_path = vendor_root.join(&manifest.files.schema.path);
    let meta_path = vendor_root.join(&manifest.files.meta.path);
    let schema = read_json(&schema_path)?;
    let meta = read_json(&meta_path)?;
    verify_checksum(&schema_path, &manifest.files.schema.sha256)?;
    verify_checksum(&meta_path, &manifest.files.meta.sha256)?;
    let validator =
        jsonschema::validator_for(&schema).map_err(|error| Error::contract(error.to_string()))?;

    let bundle = ContractBundle {
        repo_root,
        manifest,
        schema,
        meta,
        validator,
    };
    tracing::debug!(
        event_name = "contract_bundle.load.finish",
        source = "acp-contracts",
        ok = true,
        protocol_version = bundle.manifest.bundle.protocol_version
    );
    Ok(bundle)
}

/// Loads the pinned ACP vendor bundle and enforces the locked method registry.
///
/// # Errors
///
/// Returns an error when the vendored bundle cannot be loaded or when
/// `meta.json` no longer registers the full locked Phase 1 method subset.
pub fn load_locked_contract_bundle() -> Result<ContractBundle> {
    tracing::debug!(
        event_name = "contract_bundle.load_locked.start",
        source = "acp-contracts"
    );
    let bundle = load_contract_bundle()?;
    crate::validate::assert_locked_method_registration(&bundle)?;
    tracing::debug!(
        event_name = "contract_bundle.load_locked.finish",
        source = "acp-contracts",
        ok = true
    );
    Ok(bundle)
}

/// Returns the repository-relative ACP vendor root.
#[must_use]
pub fn vendor_contract_root() -> &'static str {
    "vendor/agent-client-protocol"
}

fn repo_root() -> Result<PathBuf> {
    let cwd = std::env::current_dir()
        .map_err(|source| Error::contract(format!("failed to read current directory: {source}")))?;
    if let Some(repo_root) = discover_repo_root(&cwd) {
        return Ok(repo_root);
    }

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repo_root = discover_repo_root(manifest_dir)
        .ok_or_else(|| Error::contract("could not resolve the Conduit repository root"))?;
    Ok(repo_root)
}

fn discover_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|candidate| {
            candidate.join("package.json").is_file()
                && candidate.join("backend/service/Cargo.toml").is_file()
        })
        .map(Path::to_path_buf)
}

fn contract_paths() -> Result<ContractPaths> {
    contract_paths_from(std::env::var_os(ACP_VENDOR_ROOT_ENV).as_deref())
}

fn contract_paths_from(configured_vendor_root: Option<&OsStr>) -> Result<ContractPaths> {
    if let Some(raw_vendor_root) = configured_vendor_root {
        let vendor_root = PathBuf::from(raw_vendor_root);
        if !vendor_root.is_absolute() {
            return Err(Error::contract(format!(
                "{ACP_VENDOR_ROOT_ENV} must be an absolute path"
            )));
        }
        let repo_root = vendor_root
            .parent()
            .and_then(Path::parent)
            .ok_or_else(|| {
                Error::contract(format!(
                    "{ACP_VENDOR_ROOT_ENV} must point to vendor/agent-client-protocol"
                ))
            })?
            .to_path_buf();
        return Ok(ContractPaths {
            repo_root,
            vendor_root,
        });
    }

    let repo_root = repo_root()?;
    let vendor_root = repo_root.join(vendor_contract_root());
    Ok(ContractPaths {
        repo_root,
        vendor_root,
    })
}

fn read_utf8(path: &Path) -> Result<String> {
    read_to_string(path).map_err(|source| Error::Io {
        path: path.to_path_buf(),
        source,
    })
}

fn read_json(path: &Path) -> Result<Value> {
    let contents = read_utf8(path)?;
    serde_json::from_str(&contents).map_err(|source| Error::Json {
        path: path.to_path_buf(),
        source,
    })
}

fn verify_checksum(path: &Path, expected: &str) -> Result<()> {
    let contents = std::fs::read(path).map_err(|source| Error::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let actual = format!("{:x}", Sha256::digest(contents));
    if actual == expected {
        return Ok(());
    }

    Err(Error::contract(format!(
        "{} expected sha256 {} but found {}",
        path.display(),
        expected,
        actual
    )))
}

impl ContractBundle {
    /// Returns the pinned ACP agent-method map from the vendored meta file.
    ///
    /// # Errors
    ///
    /// Returns an error when the vendored `meta.json` payload does not contain
    /// an `agentMethods` object.
    pub fn agent_method_map(&self) -> Result<BTreeMap<String, String>> {
        let map = self
            .meta
            .get("agentMethods")
            .and_then(Value::as_object)
            .ok_or_else(|| Error::contract("vendor meta.json is missing agentMethods"))?;

        let mut methods = BTreeMap::new();
        for (key, value) in map {
            let Some(value) = value.as_str() else {
                return Err(Error::contract(format!(
                    "vendor meta.json agentMethods.{key} is not a string"
                )));
            };
            methods.insert(key.clone(), value.to_owned());
        }
        Ok(methods)
    }
}

#[cfg(test)]
mod tests {
    use super::{ACP_VENDOR_ROOT_ENV, contract_paths_from};
    use std::ffi::OsStr;
    use std::path::PathBuf;

    #[test]
    fn configured_vendor_root_resolves_packaged_resource_root() {
        let vendor_root = OsStr::new("/stage/resources/vendor/agent-client-protocol");
        let paths = contract_paths_from(Some(vendor_root)).ok();

        assert_eq!(
            paths.as_ref().map(|paths| &paths.repo_root),
            Some(&PathBuf::from("/stage/resources")),
            "repo_root should be the packaged resource root"
        );
        assert_eq!(
            paths.as_ref().map(|paths| &paths.vendor_root),
            Some(&PathBuf::from(
                "/stage/resources/vendor/agent-client-protocol"
            )),
            "vendor_root should use the configured packaged ACP bundle"
        );
    }

    #[test]
    fn configured_vendor_root_must_be_absolute() {
        let message = contract_paths_from(Some(OsStr::new(
            "stage-resources/vendor/agent-client-protocol",
        )))
        .err()
        .map(|error| error.to_string());

        assert!(
            message
                .as_deref()
                .is_some_and(|message| message.contains(ACP_VENDOR_ROOT_ENV)),
            "error should mention the configured env var"
        );
    }
}
