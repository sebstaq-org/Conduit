//! Tests for generated app protocol contracts.

use crate::contracts::{ProtocolSchema, TypeScriptEmitter, acp_schema_value, root_definition};
use agent_client_protocol_schema as acp;
use serde_json::Value;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

#[test]
fn selected_roots_match_vendored_acp_schema() -> Result<(), Box<dyn Error>> {
    let vendored =
        read_json(&repo_root()?.join("vendor/agent-client-protocol/schema/schema.json"))?;
    let generated = generated_schema()?;
    for name in [
        "SessionUpdate",
        "ConfigOptionUpdate",
        "SessionConfigOption",
        "EmbeddedResource",
        "EmbeddedResourceResource",
    ] {
        ensure_equal(
            definition(&generated, name)?,
            definition(&vendored, name)?,
            &format!("schema definition {name} should match vendored ACP"),
        )?;
    }
    Ok(())
}

#[test]
fn generated_contracts_keep_structured_ui_fields() -> Result<(), Box<dyn Error>> {
    let output = TypeScriptEmitter::new(ProtocolSchema::from_acp_types()?).emit()?;
    ensure_contains(
        &output,
        "configOptions: z.array(AcpSessionConfigOptionSchema)",
    )?;
    ensure_contains(&output, "resource: AcpEmbeddedResourceResourceSchema")?;
    ensure_missing(
        &output,
        "configOptions: z.array(z.record(z.string(), z.unknown()))",
    )?;
    ensure_missing(&output, "resource: z.unknown()")?;
    Ok(())
}

#[test]
fn parity_fixtures_roundtrip_through_backend_serde() -> Result<(), Box<dyn Error>> {
    let fixtures = read_json(&repo_root()?.join("scripts/app-protocol.fixtures.json"))?;
    let Some(fixtures) = fixtures.as_object() else {
        return Err("app protocol fixtures must be a JSON object".into());
    };
    for fixture in fixtures.values() {
        let update: acp::SessionUpdate = serde_json::from_value(fixture.clone())?;
        ensure_equal(
            &serde_json::to_value(update)?,
            fixture,
            "fixture should roundtrip",
        )?;
    }
    Ok(())
}

fn ensure_contains(haystack: &str, needle: &str) -> Result<(), Box<dyn Error>> {
    if haystack.contains(needle) {
        Ok(())
    } else {
        Err(format!("generated contracts should contain {needle}").into())
    }
}

fn ensure_missing(haystack: &str, needle: &str) -> Result<(), Box<dyn Error>> {
    if haystack.contains(needle) {
        Err(format!("generated contracts should not contain {needle}").into())
    } else {
        Ok(())
    }
}

fn ensure_equal(left: &Value, right: &Value, message: &str) -> Result<(), Box<dyn Error>> {
    if left == right {
        Ok(())
    } else {
        Err(message.to_owned().into())
    }
}

fn generated_schema() -> Result<Value, Box<dyn Error>> {
    let mut schema = acp_schema_value::<acp::SessionUpdate>()?;
    let root = root_definition(&schema);
    let Some(defs) = schema.get_mut("$defs").and_then(Value::as_object_mut) else {
        return Err("generated ACP schema did not contain $defs".into());
    };
    defs.insert("SessionUpdate".to_owned(), root);
    Ok(schema)
}

fn definition<'a>(schema: &'a Value, name: &str) -> Result<&'a Value, Box<dyn Error>> {
    schema
        .get("$defs")
        .and_then(Value::as_object)
        .and_then(|defs| defs.get(name))
        .ok_or_else(|| format!("schema definition {name} is missing").into())
}

fn read_json(path: &Path) -> Result<Value, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;
    serde_json::from_str(&content).map_err(Into::into)
}

fn repo_root() -> Result<PathBuf, Box<dyn Error>> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .nth(4)
        .map(Path::to_path_buf)
        .ok_or_else(|| "could not resolve repository root".into())
}
