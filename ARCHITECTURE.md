# Architecture

Conduit is repo-structured around product boundaries instead of language buckets. Phase 1 now implements the first official-ACP-only runtime slice inside the boundaries created by Phase 0.5.

## Phase Boundary

Phase 1 includes the vendored ACP contract lock, official launcher discovery, raw stdio JSON-RPC host ownership, in-memory live session state, text-only prompt/cancel, and manual proof artifacts. It still excludes fallback runtime paths, provider-specific Conduit protocols, duplicated live DTO families above ACP, and persisted runtime truth.

## TypeScript Layer

- `apps/desktop` contains the minimal proof surface for the locked ACP subset; `apps/mobile` remains a shell entrypoint.
- `packages/session-model` owns shared session identity and lifecycle vocabulary.
- `packages/session-contracts` owns app-facing snapshots and the locked ACP method list.
- `packages/session-client` owns the client boundary toward the future service.
- `packages/provider-catalog` owns provider provenance and launcher policy metadata.
- `packages/ui` owns shared UI-facing copy and display scaffolding only.

## Rust Layer

- `backend/service/crates/acp-contracts` owns the vendor-facing contract lock and locked-subset envelope validation.
- `backend/service/crates/acp-core` owns ACP process lifecycle, raw JSON-RPC stdio, request tracking, live initialize truth, events, snapshots, sessions, prompt, and cancel.
- `backend/service/crates/acp-discovery` owns official launcher resolution, initialize viability, raw discovery captures, and transport diagnostics.
- `backend/service/crates/app-api` owns the app-facing Phase 1 provider/session operations.
- `backend/service/crates/provider-*` own provider launcher descriptors only.
- `backend/service/crates/repo-guard` owns repo guard rails as a normal workspace crate under the same Rust policy as every other crate.
- `backend/service/crates/session-store` reserves read-side and persistence boundaries.
- `backend/service/crates/service-bin` is the runtime workspace composition root.
- Rust guard rails treat `service-bin` as the only runtime composition root, keep `acp-contracts` vendor-facing only, keep `repo-guard` isolated from runtime crates, and block provider crates from depending upward into `app-api`, `session-store`, or sibling providers.

## Deferred Slots

Native bridge directories stay deferred until a concrete desktop or mobile bridge exists, so Phase 1 does not create empty platform trees that might force early boundary decisions.
