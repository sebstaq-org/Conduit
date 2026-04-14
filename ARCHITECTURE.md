# Architecture

Conduit is organized around product boundaries, not language buckets.

## Product Boundaries

- `apps/frontend` owns product UI for React Native and React Native Web.
- `apps/desktop` owns Electron host integration for the frontend web target.
- `packages/session-client` owns platform-neutral consumer transport.
- `packages/session-contracts` owns consumer command and envelope contracts.
- `packages/session-model` owns platform-neutral read-side session/provider shapes.
- `packages/app-client` owns proof-surface client contracts.
- `packages/app-core` owns framework-neutral re-exported app-facing contracts.
- `packages/design-system-tokens` owns non-rendering token/copy contracts.

Feature code must stay behind these boundaries: apps may depend on packages, apps must not depend on each other, and feature code must not import backend internals directly.

## Runtime Surface

- `backend/service/crates/service-bin` is the runtime composition root.
- `service-bin serve` exposes:
  - `GET /health`
  - `GET /api/catalog`
  - `GET /api/session` (WebSocket)
- Default serve bind is `127.0.0.1:4174`, so default session transport is `ws://127.0.0.1:4174/api/session`.
- Transport frames are versioned (`v: 1`) and correlated by `id`.

## Rust Workspace Ownership

- `acp-contracts`: vendor-lock and ACP subset envelope validation.
- `acp-core`: ACP process lifecycle, JSON-RPC stdio, session/prompt event truth.
- `acp-discovery`: official launcher resolution and discovery diagnostics.
- `app-api`: app-facing provider/session operations.
- `provider-*`: provider launcher descriptors.
- `session-store`: local store and persistence boundary.
- `repo-guard`: repository structure and policy guardrails.

Rust policy is deny-first and enforced through workspace lints, clippy, rustdoc warnings-as-errors, and crate-edge checks.

## Frontend Guardrails

- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Feature modules must not perform direct transport/fetch/WebSocket command dispatch; async backend reads go through `apps/frontend/src/app-state`.
- Raw DOM and React Native primitives are reserved for app UI primitives and shell code.
- Placeholder feature behavior and speculative fallback paths are forbidden.

## Policy Registries

- `scripts/shared-capability-registry.ts`
- `scripts/design-system-parity-registry.ts`

These files are policy data surfaces; they must not become runtime behavior sources.
