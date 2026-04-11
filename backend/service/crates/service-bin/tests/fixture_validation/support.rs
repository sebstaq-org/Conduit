//! Shared entrypoints for ACP fixture validation tests.

pub(crate) mod common;
mod hygiene;
mod protocol;
mod replay;

use common::{PROVIDERS, ValidationResult};
use std::path::Path;

pub(crate) use common::{
    TestResult, ValidationContext, ValidationReport, require_message_parts, temp_testdata_root,
    testdata_root, write_minimal_replay_fixture,
};
pub(crate) use hygiene::validate_hygiene_text;
pub(crate) use replay::validate_replay_provider;

pub(crate) fn validate_fixture_library(testdata_root: &Path) -> ValidationResult<()> {
    let mut report = ValidationReport::default();
    for provider in PROVIDERS {
        replay::validate_replay_provider(testdata_root, provider, &mut report)?;
        protocol::validate_protocol_provider(testdata_root, provider, &mut report)?;
    }
    if report.replay_transport_gaps.is_empty() && report.protocol_coverage_gaps.is_empty() {
        return Err("fixture validation did not record any transport coverage state".to_owned());
    }
    Ok(())
}
