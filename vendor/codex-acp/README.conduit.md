# Conduit Codex ACP Adapter

This directory vendors the patched Codex ACP adapter that Conduit uses for Codex plan-mode proof and runtime work.

Provenance:

- Upstream repo: `https://github.com/zed-industries/codex-acp.git`
- Upstream PR ref: `refs/pull/195/head`
- Vendored branch at capture time: `pr-195-head`
- Vendored commit: `4ae9064c922c1b06d7b1eef08a9502c8cd9326da`
- Additional local patch files carried into this vendored copy: `src/codex_agent.rs`, `src/thread.rs`

Only the Rust adapter source needed to build `codex-acp` is vendored here. Build outputs, git metadata, npm packaging helpers, CI files, logs, captures, and local proof artifacts are intentionally excluded.

Build and install the adapter from the Conduit repo root:

```sh
rtk pnpm run codex-acp:build
```

The script builds this crate with `cargo build --locked --release` and installs the managed binary at `.conduit/bin/codex-acp`. Conduit resolves Codex through the normal launcher name `codex-acp`, but Codex discovery prefers the managed vendored binary and stage releases copy the same binary beside `service-bin`.

When updating this dependency, refresh from upstream PR/source outside the repo, inspect the diff for secrets or local artifacts, copy only source files into this directory, rebuild with `rtk pnpm run codex-acp:build`, and verify with Conduit capture CLI before committing.
