# Frontend Architecture

This document is the canonical frontend architecture note for the current shell-init pass and shared consumer boundary.

## Decision

Conduit should behave as one product with two shells:

- desktop in Electron
- mobile in React Native

Shared frontend work should prioritize semantics first:

- shared transport and contract adaptation
- shared framework-neutral feature logic
- shared component API contracts
- shared semantic token contracts

Raw DOM and React Native implementation should remain platform-owned.

## Package Ownership

- `packages/app-client`
  - app-facing capability client and contract adaptation only
- `packages/app-core`
  - framework-neutral provider/session vocabulary, reducers, selectors, and view-model logic only
- `packages/design-system-tokens`
  - semantic token contracts only; proof-surface copy is allowed for Phase 1 evidence
- `packages/design-system-desktop`
  - future desktop primitives behind Conduit-owned component APIs
- `packages/design-system-mobile`
  - future mobile primitives behind the same Conduit-owned component APIs
- `apps/desktop`
  - Electron shell and desktop integration only, including the minimum runtime wiring needed to launch
- `apps/mobile`
  - React Native shell and mobile integration only, including the minimum runtime wiring needed to launch

## Hard Rules

- Do not add placeholder UI.
- Do not add starter primitives, starter themes, or fake token values.
- Do not add feature stubs.
- Do not import one app from the other.
- Do not put shared feature behavior directly in `apps/*`.
- Do not import future backend contracts directly from app or feature code.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Raw DOM and React Native primitives are reserved for design-system and shell boundaries.

## Future Delivery Order

Cross-platform feature work should land in this order:

1. future app-facing backend boundary
2. `packages/app-client`
3. `packages/app-core`
4. desktop shell integration
5. mobile shell integration

If a capability is intended for both platforms, it is not complete until both shells exist.
