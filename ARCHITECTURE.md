# Architecture

Conduit is structured around product boundaries instead of language buckets. The current pass keeps the locked frontend workspace shape and policy, upgrades `apps/desktop` and `apps/mobile` into real runnable shells without placeholder UI, and layers the Phase 1.5 official-ACP-only consumer API over the Rust backend.

## Current Pass

Phase 1 includes the vendored ACP contract lock, official launcher discovery, raw stdio JSON-RPC host ownership, in-memory live session state, text-only prompt/cancel, and manual proof artifacts. It still excludes fallback runtime paths, provider-specific Conduit protocols, duplicated live DTO families above ACP, and persisted runtime truth.

This pass also includes:

- final frontend package names
- runnable desktop and mobile shells
- normal consumer API session package boundaries
- frontend ownership canon
- local and repo-wide agent rules
- empty registry surfaces for future policy enforcement
- current structure guard rails updated to the target frontend tree
- Phase 0.5 repository shape, pinned toolchains, check chains, repo bootstrap automation, and the Phase 1 ACP runtime baseline

This pass explicitly excludes:

- fallback runtime paths
- provider-specific Conduit protocols
- duplicated live runtime DTO families above ACP
- persisted runtime truth
- general product UI beyond the minimal desktop proof surface
- speculative design tokens, primitives, themes, or feature stubs

## Frontend Layer

- `apps/desktop` is the Electron shell only.
- `apps/mobile` is the React Native shell only.
- `packages/session-client` owns the normal consumer transport boundary.
- `packages/session-contracts` owns shared consumer command and transport envelopes.
- `packages/session-model` owns provider/session model vocabulary.
- `packages/app-client` owns the proof-surface contract boundary.
- `packages/app-core` owns framework-neutral reducers, selectors, and view-model logic.
- `packages/design-system-tokens` reserves the semantic design-token contract boundary.
- `packages/design-system-desktop` reserves desktop primitive implementations behind Conduit-owned component APIs.
- `packages/design-system-mobile` reserves mobile primitive implementations behind the same Conduit-owned component APIs.

The frontend rule is strict:

- share semantics
- share component API
- share token contracts
- do not share raw DOM and React Native implementation

## Frontend Delivery Order

Cross-platform frontend work should land in this order:

1. app-facing backend boundary
2. `packages/app-client`
3. `packages/app-core`
4. `apps/desktop` shell integration
5. `apps/mobile` shell integration

If a capability is intended for both platforms, it should not be treated as complete until both shells exist.

## Frontend Boundaries

- Apps may depend on packages, but apps may not depend on each other.
- Shared frontend behavior must not live directly under `apps/*`.
- Feature code must not import backend-owned contracts directly; that boundary belongs in `packages/app-client`.
- Raw DOM and React Native primitives are reserved for design-system and shell boundaries.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Placeholder UI is forbidden. Do not create example components, starter themes, fake tokens, or speculative feature stubs.

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

## Policy Surfaces

This pass introduces two empty policy surfaces for future Rust enforcement:

- `scripts/shared-capability-registry.ts`
- `scripts/design-system-parity-registry.ts`

They define frontend policy data only. They do not implement product behavior or become a second source of truth next to future Rust policy code.
Native bridge directories stay deferred until a concrete desktop or mobile bridge exists, so Phase 1 does not create empty platform trees that might force early boundary decisions.
