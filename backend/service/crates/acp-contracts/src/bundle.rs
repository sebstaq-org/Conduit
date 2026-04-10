//! Loading for the vendored ACP schema bundle.

use crate::error::{Error, Result};
use jsonschema::Validator;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};

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

/// Loads the pinned ACP vendor bundle from the repository.
///
/// # Errors
///
/// Returns an error when the repository root cannot be resolved, the vendored
/// manifest or schema files cannot be read or parsed, or the vendored bundle
/// checksums no longer match the pinned manifest.
pub fn load_contract_bundle() -> Result<ContractBundle> {
    let repo_root = repo_root()?;
    let vendor_root = repo_root.join("vendor/agent-client-protocol");
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

    Ok(ContractBundle {
        repo_root,
        manifest,
        schema,
        meta,
        validator,
    })
}

/// Loads the pinned ACP vendor bundle and enforces the locked method registry.
///
/// # Errors
///
/// Returns an error when the vendored bundle cannot be loaded or when
/// `meta.json` no longer registers the full locked Phase 1 method subset.
pub fn load_locked_contract_bundle() -> Result<ContractBundle> {
    let bundle = load_contract_bundle()?;
    crate::validate::assert_locked_method_registration(&bundle)?;
    Ok(bundle)
}

/// Returns the repository-relative ACP vendor root.
#[must_use]
pub fn vendor_contract_root() -> &'static str {
    "vendor/agent-client-protocol"
}

fn repo_root() -> Result<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .ancestors()
        .nth(4)
        .ok_or_else(|| Error::contract("could not resolve the Conduit repository root"))?;
    Ok(repo_root.to_path_buf())
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

        Ok(map
            .iter()
            .map(|(key, value)| {
                let value = value.as_str().unwrap_or_default().to_owned();
                (key.clone(), value)
            })
            .collect())
    }
}
