# Frontend Architecture

This document is the canonical frontend architecture note for the React Native Web frontend foundation and shared consumer boundary.

## Decision

Conduit should behave as one product with one frontend app:

- `apps/frontend` targets React Native and React Native Web
- `apps/desktop` hosts the frontend web target in Electron

Shared frontend work should prioritize semantics first:

- shared transport and contract adaptation
- shared framework-neutral feature logic
- app-local UI primitives and tokens until extraction is justified

Raw React Native implementation belongs in `apps/frontend/src/ui` primitives and shell integration, not in feature composition.

## Package Ownership

- `packages/app-client`
  - app-facing capability client and contract adaptation only
- `packages/app-core`
  - framework-neutral provider/session vocabulary, reducers, selectors, and view-model logic only
- `packages/design-system-tokens`
  - semantic token contracts only; proof-surface copy is allowed for Phase 1 evidence
- `apps/desktop`
  - Electron host and desktop integration only
- `apps/frontend`
  - Expo/React Native UI app, app-local tokens, primitives, screens, and local features

## Hard Rules

- Do not add placeholder UI.
- Do not add starter primitives, starter themes, or fake token values.
- Do not add feature stubs.
- Do not import one app from the other.
- Do not put backend-facing shared behavior directly in app feature code.
- Do not import future backend contracts directly from app or feature code.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Raw DOM and React Native primitives are reserved for app UI primitives and shell boundaries.

## Future Delivery Order

Cross-platform feature work should land in this order:

1. future app-facing backend boundary
2. `packages/app-client`
3. `packages/app-core`
4. frontend UI integration
5. desktop host integration

If a capability is intended for both platforms, it is not complete until both shells exist.
