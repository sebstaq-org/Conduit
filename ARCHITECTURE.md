# Architecture

Conduit is structured around product boundaries instead of language buckets. The current pass locks the final frontend workspace shape and policy so desktop and mobile can be built on one shared semantic model without placeholder UI.

## Current Pass

This pass includes:

- final frontend package names
- shell-only desktop and mobile apps
- frontend ownership canon
- local and repo-wide agent rules
- empty registry surfaces for future policy enforcement
- current structure guard rails updated to the target frontend tree

This pass explicitly excludes:

- ACP host behavior
- provider runtime launches
- session persistence logic
- generated backend contracts
- product UI
- design tokens
- primitives
- themes
- feature implementations
- fallback runtime paths

## Frontend Layer

- `apps/desktop` is the future Electron shell only.
- `apps/mobile` is the future React Native shell only.
- `packages/app-client` owns the future frontend transport and contract adaptation boundary.
- `packages/app-core` owns future framework-neutral reducers, selectors, and view-model logic.
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

1. future app-facing backend boundary
2. `packages/app-client`
3. `packages/app-core`
4. `apps/desktop` shell integration
5. `apps/mobile` shell integration

If a capability is intended for both platforms, it should not be treated as complete until both shells exist.

## Frontend Boundaries

- Apps may depend on packages, but apps may not depend on each other.
- Shared frontend behavior must not live directly under `apps/*`.
- Feature code must not import backend-owned contracts directly; that future boundary belongs in `packages/app-client`.
- Raw DOM and React Native primitives are reserved for design-system and shell boundaries.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Placeholder UI is forbidden. Do not create example components, starter themes, fake tokens, or speculative feature stubs.

## Rust Layer

Backend ownership is unchanged and out of scope for this pass.

- `backend/service/crates/acp-contracts` reserves the vendor-facing contract boundary.
- `backend/service/crates/acp-core` reserves the ACP runtime ownership boundary.
- `backend/service/crates/acp-discovery` reserves launcher and readiness provenance.
- `backend/service/crates/app-api` reserves the app-facing service surface.
- `backend/service/crates/provider-*` reserve provider-specific adapter homes.
- `backend/service/crates/session-store` reserves read-side and persistence boundaries.
- `backend/service/crates/service-bin` is the workspace binary entrypoint.

## Policy Surfaces

This pass introduces two empty policy surfaces for future Rust enforcement:

- `scripts/shared-capability-registry.ts`
- `scripts/design-system-parity-registry.ts`

They define frontend policy data only. They do not implement product behavior or become a second source of truth next to future Rust policy code.
