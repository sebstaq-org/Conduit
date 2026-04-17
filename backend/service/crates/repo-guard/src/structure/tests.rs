//! Tests for repo structure enforcement.

use super::collect_failures;
use super::rust::Dependency;
use super::tests_support::{ensure, ensure_any, ensure_contains, fixture, write_file};
use crate::error::Result;

#[test]
fn accepts_the_approved_layout() -> Result<()> {
    let fixture = fixture()?;
    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure(failures.is_empty(), "expected no structure failures")
}

#[test]
fn rejects_framework_runtime_imports_in_framework_neutral_packages() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture.repo_root.join("packages/app-core/src/index.ts"),
        "import { useState } from 'react';\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "packages/app-core/src/index.ts imports forbidden framework or shell runtime via react.",
    )
}

#[test]
fn rejects_app_protocol_imports_from_frontend_feature_code() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("apps/frontend/src/features/session/protocol.ts"),
        "import type { AcpSessionUpdate } from '@conduit/app-protocol';\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "apps/frontend/src/features/session/protocol.ts imports @conduit/app-protocol outside the client/adaptation boundary.",
    )
}

#[test]
fn accepts_app_protocol_imports_from_frontend_protocol_adapter() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture.repo_root.join("apps/frontend/package.json"),
        concat!(
            "{\n",
            "  \"name\": \"@conduit/frontend\",\n",
            "  \"private\": true,\n",
            "  \"version\": \"0.5.0\",\n",
            "  \"dependencies\": {\n",
            "    \"@conduit/app-protocol\": \"workspace:*\"\n",
            "  }\n",
            "}\n",
        ),
    )?;
    write_file(
        &fixture
            .repo_root
            .join("apps/frontend/src/app-state/protocol/session-update.ts"),
        "import type { AcpSessionUpdate } from '@conduit/app-protocol';\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure(
        failures.is_empty(),
        "expected frontend protocol adapter imports to pass",
    )
}

#[test]
fn rejects_app_protocol_imports_from_non_protocol_app_state() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture.repo_root.join("apps/frontend/package.json"),
        concat!(
            "{\n",
            "  \"name\": \"@conduit/frontend\",\n",
            "  \"private\": true,\n",
            "  \"version\": \"0.5.0\",\n",
            "  \"dependencies\": {\n",
            "    \"@conduit/app-protocol\": \"workspace:*\"\n",
            "  }\n",
            "}\n",
        ),
    )?;
    write_file(
        &fixture
            .repo_root
            .join("apps/frontend/src/app-state/session/protocol.ts"),
        "import type { AcpSessionUpdate } from '@conduit/app-protocol';\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "apps/frontend/src/app-state/session/protocol.ts imports @conduit/app-protocol outside the client/adaptation boundary.",
    )
}

#[test]
fn rejects_backend_wire_contracts_in_session_contracts() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("packages/session-contracts/src/wire.ts"),
        "export type ServerFrame = { type: 'event' };\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "packages/session-contracts/src/wire.ts defines backend-to-frontend wire contract ServerFrame; use @conduit/app-protocol in client/adaptation layers instead.",
    )
}

#[test]
fn accepts_backend_wire_contract_names_in_comments_and_strings() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("packages/session-contracts/src/wire.ts"),
        concat!(
            "// RuntimeEvent is documented here but not defined.\n",
            "export const note = 'ServerFrame';\n",
            "export type LocalRuntimeEventName = string;\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure(failures.is_empty(), "expected comments and strings to pass")
}

#[test]
fn rejects_backend_wire_contracts_reexported_from_session_contracts() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("packages/session-contracts/src/wire.ts"),
        "type Local = string;\nexport type { Local, RuntimeEvent };\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "packages/session-contracts/src/wire.ts defines backend-to-frontend wire contract RuntimeEvent; use @conduit/app-protocol in client/adaptation layers instead.",
    )
}

#[test]
fn rejects_forbidden_provider_dependencies() -> Result<()> {
    let mut fixture = fixture()?;
    if let Some(resolve) = fixture.metadata.resolve.as_mut()
        && let Some(node) = resolve
            .nodes
            .iter_mut()
            .find(|node| node.id == "provider-codex")
    {
        node.dependencies.push("provider-claude".to_owned());
    }

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "provider-codex may not depend on provider-claude.",
    )
}

#[test]
fn rejects_forbidden_library_error_aggregators() -> Result<()> {
    let mut fixture = fixture()?;
    if let Some(package) = fixture
        .metadata
        .packages
        .iter_mut()
        .find(|package| package.name == "acp-core")
    {
        package.dependencies.push(Dependency {
            name: "anyhow".to_owned(),
        });
    }

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "acp-core may not depend on anyhow; library crates must expose concrete error types.",
    )
}

#[test]
fn rejects_non_tracing_logging_dependencies() -> Result<()> {
    let mut fixture = fixture()?;
    if let Some(package) = fixture
        .metadata
        .packages
        .iter_mut()
        .find(|package| package.name == "session-store")
    {
        package.dependencies.push(Dependency {
            name: "log".to_owned(),
        });
    }

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "session-store may not depend on log; Rust logging must use tracing.",
    )
}

#[test]
fn requires_tracing_subscriber_in_service_binaries() -> Result<()> {
    let mut fixture = fixture()?;
    if let Some(package) = fixture
        .metadata
        .packages
        .iter_mut()
        .find(|package| package.name == "service-bin")
    {
        package
            .dependencies
            .retain(|dependency| dependency.name != "tracing-subscriber");
    }

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "service-bin must depend on tracing-subscriber for runtime logging.",
    )
}

#[test]
fn rejects_forbidden_service_runtime_dependencies() -> Result<()> {
    let mut fixture = fixture()?;
    if let Some(resolve) = fixture.metadata.resolve.as_mut()
        && let Some(node) = resolve
            .nodes
            .iter_mut()
            .find(|node| node.id == "service-runtime")
    {
        node.dependencies.push("provider-codex".to_owned());
    }

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_contains(
        &failures,
        "service-runtime may not depend on provider-codex; it must stay above app-api and ACP-facing crates only.",
    )
}

#[test]
fn rejects_missing_crate_docs() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        "fn local_stub() {}\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("acp-core must declare crate-level docs"),
        "expected missing crate docs failure",
    )
}

#[test]
fn rejects_forbidden_extern_syntax() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        "//! Crate docs.\n\nunsafe extern \"C\" {\n    fn ffi();\n}\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("uses forbidden extern/FFI syntax"),
        "expected forbidden extern syntax failure",
    )
}

#[test]
fn rejects_broad_inner_suppressions() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        "//! Crate docs.\n#![allow(dead_code, reason = \"bad\")]\n\nfn local_stub() {}\n",
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("forbidden crate-wide lint suppression"),
        "expected broad suppression failure",
    )
}

#[test]
fn accepts_comments_and_strings_that_mention_forbidden_syntax() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        concat!(
            "//! Crate docs.\n",
            "/// Mentioning extern \"C\" in docs must not fail.\n",
            "fn local_stub() {\n",
            "    let example = \"static mut and pub use demo::* are text only\";\n",
            "    let _ = example;\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure(
        failures.is_empty(),
        "expected comments and strings mentioning forbidden syntax to pass",
    )
}

#[test]
fn rejects_module_outer_suppressions() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        concat!(
            "//! Crate docs.\n\n",
            "#[allow(dead_code, reason = \"bad\")]\n",
            "mod blocked {\n",
            "    pub(super) fn local_stub() {}\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("forbidden module-wide lint suppression"),
        "expected module-wide outer suppression failure",
    )
}

#[test]
fn rejects_nested_module_inner_suppressions() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        concat!(
            "//! Crate docs.\n\n",
            "mod blocked {\n",
            "    #![expect(dead_code, reason = \"bad\")]\n",
            "    pub(super) fn local_stub() {}\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("forbidden module-wide lint suppression"),
        "expected module-wide inner suppression failure",
    )
}

#[test]
fn rejects_direct_stdout_imports() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/acp-core/src/lib.rs"),
        concat!(
            "//! Crate docs.\n\n",
            "use std::io::stdout;\n\n",
            "fn local_stub() {\n",
            "    let _ = stdout();\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("directly imports forbidden stdout/stderr emission helpers"),
        "expected direct stdout import failure",
    )
}

#[test]
fn accepts_runtime_cli_stdout_boundary() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/service-bin/src/runtime.rs"),
        concat!(
            "//! Crate docs.\n\n",
            "fn local_stub() {\n",
            "    let _ = std::io::stdout();\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure(
        failures.is_empty(),
        "expected runtime CLI stdout boundary to pass",
    )
}

#[test]
fn rejects_runtime_cli_stderr_boundary() -> Result<()> {
    let fixture = fixture()?;
    write_file(
        &fixture
            .repo_root
            .join("backend/service/crates/service-bin/src/runtime.rs"),
        concat!(
            "//! Crate docs.\n\n",
            "fn local_stub() {\n",
            "    let _ = std::io::stderr();\n",
            "}\n",
        ),
    )?;

    let failures = collect_failures(&fixture.repo_root, &fixture.metadata)?;
    ensure_any(
        &failures,
        |failure| failure.contains("directly emits to forbidden stdout/stderr output"),
        "expected runtime CLI stderr boundary failure",
    )
}
