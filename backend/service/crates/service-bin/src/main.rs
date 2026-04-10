#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

use acp_discovery::PROVIDER_LAUNCHERS;
use app_api::bootstrap_surface;
use provider_claude::descriptor as claude_descriptor;
use provider_codex::descriptor as codex_descriptor;
use provider_copilot::descriptor as copilot_descriptor;
use session_store::bootstrap_store_boundary;
use std::io::{self, Write};

fn main() -> io::Result<()> {
    let surface = bootstrap_surface();
    let provider_summary = [
        format!(
            "{}={}",
            claude_descriptor().provider,
            claude_descriptor().launcher
        ),
        format!(
            "{}={}",
            codex_descriptor().provider,
            codex_descriptor().launcher
        ),
        format!(
            "{}={}",
            copilot_descriptor().provider,
            copilot_descriptor().launcher
        ),
    ]
    .join(", ");
    let store_boundary = bootstrap_store_boundary();
    let mut stdout = io::stdout().lock();

    writeln!(stdout, "Conduit Phase {} bootstrap ready.", surface.phase)?;
    writeln!(stdout, "Policy: {}", surface.policy)?;
    writeln!(
        stdout,
        "Locked methods: {}",
        surface.locked_methods.join(", ")
    )?;
    writeln!(
        stdout,
        "Discovery catalog entries: {}",
        PROVIDER_LAUNCHERS.len()
    )?;
    writeln!(stdout, "Provider launchers: {provider_summary}")?;
    writeln!(
        stdout,
        "Store boundary: {} / {}",
        store_boundary.live_truth, store_boundary.allowed_scope
    )?;

    Ok(())
}
