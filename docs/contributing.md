# Contributing

Add code only inside the approved tree.

- New shared frontend code belongs in `packages/`.
- New desktop or mobile shell code belongs in `apps/`.
- New Rust service code belongs in `backend/service/crates/`.
- Pinned external schemas or manifests belong in `vendor/agent-client-protocol/`.
- Generated proof belongs in `artifacts/manual/` or `artifacts/automated/`.

Structural rules are enforced by `rtk pnpm run structure:check`, which runs the Rust `repo-guard` crate. If a new package or crate is needed, update the approved tree in the structure check and the architecture docs in the same change. If a task starts to require fallback runtime behavior, a provider-specific Conduit protocol, or duplicated live runtime DTOs above ACP, stop and update the Phase notes instead of inventing a temporary path.

Rust is intentionally hard-default. Keep new crates in the workspace, satisfy the curated workspace lint set, and preserve the crate-edge rules enforced from `cargo metadata`. `service-bin` stays the only runtime composition root, and `repo-guard` is not exempt from any Rust policy. For Rust-specific authoring rules, follow `backend/service/AGENTS.md` and `docs/rust-policy.md`.

For the current frontend foundation pass:

- `apps/desktop` may contain the minimal Phase 1 proof surface; `apps/mobile` stays shell-only.
- `packages/session-client` is the normal consumer transport boundary for versioned `service-bin serve` WebSocket frames.
- `packages/session-contracts` is the shared command/envelope contract boundary.
- `packages/app-client` is proof-surface-only and must not grow normal runtime APIs.
- `packages/app-core` is the framework-neutral logic and provider/session vocabulary boundary.
- `packages/design-system-*` reserve UI boundaries. Do not add speculative components, themes, or fake tokens.
- Do not create placeholder UI or “temporary” shared abstractions.
