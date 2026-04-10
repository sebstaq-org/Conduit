# Architecture

Conduit is repo-structured around product boundaries instead of language buckets. Phase 0.5 creates those boundaries now so Phase 1 can add the official ACP host and provider adapters without moving modules again.

## Phase Boundary

Phase 0.5 includes repository shape, pinned toolchains, check chains, repo bootstrap automation, and compile-safe stubs. It explicitly excludes ACP host behavior, provider runtime launches, session persistence logic, product UI, and any fallback runtime path.

## TypeScript Layer

- `apps/desktop` and `apps/mobile` are shell entrypoints only.
- `packages/session-model` owns shared session identity and lifecycle vocabulary.
- `packages/session-contracts` owns app-facing snapshots and the locked ACP method list.
- `packages/session-client` owns the client boundary toward the future service.
- `packages/provider-catalog` owns provider provenance and launcher policy metadata.
- `packages/ui` owns shared UI-facing copy and display scaffolding only.

## Rust Layer

- `backend/service/crates/acp-contracts` reserves the vendor-facing contract boundary.
- `backend/service/crates/acp-core` reserves the ACP runtime ownership boundary.
- `backend/service/crates/acp-discovery` reserves launcher and readiness provenance.
- `backend/service/crates/app-api` reserves the app-facing service surface.
- `backend/service/crates/provider-*` reserve provider-specific adapter homes.
- `backend/service/crates/repo-guard` owns repo guard rails as a normal workspace crate under the same Rust policy as every other crate.
- `backend/service/crates/session-store` reserves read-side and persistence boundaries.
- `backend/service/crates/service-bin` is the runtime workspace composition root.
- Rust guard rails treat `service-bin` as the only runtime composition root, keep `acp-contracts` vendor-facing only, keep `repo-guard` isolated from runtime crates, and block provider crates from depending upward into `app-api`, `session-store`, or sibling providers.

## Deferred Slots

`backend/service` is the only backend subtree created in Phase 0.5. Native bridge directories stay deferred until a concrete desktop or mobile bridge exists, so the bootstrap does not create empty platform trees that might force early boundary decisions.
