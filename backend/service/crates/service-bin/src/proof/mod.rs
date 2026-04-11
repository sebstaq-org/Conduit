//! Isolated proof-workspace helpers and scenario capture aggregation.

mod capture;
mod home;
mod isolation;
mod workspace;

pub(crate) use self::capture::{ScenarioCapture, write_capture};
pub(crate) use self::isolation::verify_discovery_capture;
pub(crate) use self::workspace::ProofWorkspace;
