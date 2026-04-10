# Contributing

Add code only inside the approved tree.

- New shared frontend code belongs in `packages/`.
- New desktop or mobile shell code belongs in `apps/`.
- New Rust service code belongs in `backend/service/crates/`.
- Pinned external schemas or manifests belong in `vendor/agent-client-protocol/`.
- Generated proof belongs in `artifacts/manual/` or `artifacts/automated/`.

Structural rules are enforced by `rtk pnpm run structure:check`, which now runs the Rust `repo-guard` crate instead of TypeScript repo scripts. If a new package or crate is needed, update the approved tree in the structure check and the architecture docs in the same change. If a task starts to require ACP host logic, provider runtime logic, or provider-specific live behavior, stop at the boundary and leave a TODO for Phase 1 instead of inventing a temporary path.

Rust is intentionally hard-default. Keep new crates in the workspace, satisfy the curated workspace lint set, and preserve the crate-edge rules enforced from `cargo metadata`. `service-bin` stays the only runtime composition root, and `repo-guard` is not exempt from any Rust policy. For Rust-specific authoring rules, follow `backend/service/AGENTS.md` and `docs/rust-policy.md`.

For the current frontend foundation pass:

- `apps/desktop` and `apps/mobile` stay shell-only.
- `packages/app-client` is the future contract and transport boundary.
- `packages/app-core` is the future framework-neutral logic boundary.
- `packages/design-system-*` reserve UI boundaries only. Do not add components, themes, or tokens yet.
- Do not create placeholder UI or “temporary” shared abstractions.
