use super::parse_command;
use acp_discovery::ProviderId;
use std::path::Path;

mod parse_success;
mod rejections;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
