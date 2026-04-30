# Conduit Codex ACP Adapter

This directory vendors the patched Codex ACP adapter that Conduit uses for Codex plan-mode and runtime work.

Provenance:

- Upstream repo: `https://github.com/zed-industries/codex-acp.git`
- Upstream tag: `v0.12.0`
- Upstream commit: `ee9418a65befdf08c3793d9a92dd4a083f545fcf`
- Codex dependency tag: `rust-v0.124.0`
- Local Conduit patches: `src/thread.rs`
- Historical PR195 patch provenance: `provenance/upstream-pr195.patch`, `provenance/conduit-local.patch`

Current Conduit patches preserve:

- Codex collaboration mode as `session/set_config_option(collaboration_mode=...)`.
- Codex `RequestUserInput` as ACP `session/request_permission`, including `answer-other` free text through `_meta.request_user_input_response`.
- Codex `TurnItem::Plan` as `_meta.codex.terminalPlan` on an ACP `agent_message_chunk`, which Conduit normalizes into a terminal plan transcript event.

Only the Rust adapter source needed to build `codex-acp` is vendored here. Build outputs, git metadata, npm packaging helpers, CI files, logs, captures, and local proof artifacts are intentionally excluded.

Build and install the adapter from the Conduit repo root:

```sh
rtk pnpm run codex-acp:build
```

The script builds this crate with `cargo build --locked --release` and installs the managed binary at `.conduit/bin/codex-acp`. `rtk pnpm run codex-acp:check` builds and verifies the managed binary. Conduit resolves Codex through the normal launcher name `codex-acp`, but Codex discovery prefers the managed vendored binary and stage releases copy the same binary beside `service-bin`.

The adapter depends on `libcap` at build time. Normal Linux environments should provide `pkg-config` and `libcap-dev`; local non-system installs can set `CONDUIT_CODEX_ACP_LIBCAP_SYSROOT` to a sysroot containing the libcap pkg-config file.

When updating this dependency, refresh from an upstream tag outside the repo, inspect the diff for secrets or local artifacts, copy only source files into this directory, rebuild with `rtk pnpm run codex-acp:build`, and verify with Conduit capture CLI before committing.
