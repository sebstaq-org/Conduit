# Contributing

Add code only inside the approved tree.

- New shared backend-facing frontend code belongs in `packages/`.
- New product UI code belongs in `apps/frontend/src`.
- New Electron host code belongs in `apps/desktop`.
- New Rust service code belongs in `backend/service/crates/`.
- Pinned external schemas or manifests belong in `vendor/agent-client-protocol/`.
- Manual proof belongs outside the repo under `/srv/devops/repos/conduit-artifacts/manual/`; generated CI or scripted proof may go in `artifacts/automated/` when it is explicitly meant to stay in the repo.

Structural rules are enforced by `rtk pnpm run structure:check`, which runs the Rust `repo-guard` crate. If a new package or crate is needed, update the approved tree in the structure check and the architecture docs in the same change. If a task requires fallback runtime behavior, a provider-specific Conduit protocol, or duplicated live runtime DTOs above ACP, update architecture and policy docs before implementation.

Rust is intentionally hard-default. Keep new crates in the workspace, satisfy the curated workspace lint set, and preserve the crate-edge rules enforced from `cargo metadata`. `service-bin` stays the only runtime composition root, and `repo-guard` is not exempt from any Rust policy. For Rust-specific authoring rules, follow `backend/service/AGENTS.md` and `docs/rust-policy.md`.

Frontend boundary rules:

- `apps/frontend` owns the React Native and React Native Web UI app; `apps/desktop` hosts the web target.
- `packages/app-protocol` is the shared generated and versioned UI<>backend protocol boundary.
- `packages/session-client` is the normal runtime client boundary above that protocol.
- `packages/app-client` is proof-surface-only and must not grow normal runtime APIs.
- Feature and screen code in `apps/frontend/src` must consume backend-facing behavior through `src/app-state`.
- App-local UI primitives and tokens belong under `apps/frontend/src/ui`.
- Do not create placeholder feature behavior or ad hoc shared abstractions.
