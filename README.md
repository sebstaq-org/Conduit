# Conduit

Conduit is in a frontend foundation pass. This pass locks the desktop/mobile package shape, repo rules, and agent workflow before any product UI, design tokens, primitives, themes, or features are built.

## Happy Path

1. `rtk pnpm install`
2. `rtk pnpm run bootstrap`
3. `rtk pnpm run check`

## Frontend Structure

```text
apps/                         Electron and React Native shells only
packages/app-client/          shared frontend transport boundary
packages/app-core/            shared framework-neutral feature logic
packages/design-system-*/     shared UI boundaries without implementation yet
backend/                      Rust service workspace and future backend-owned assets
vendor/                       pinned external sources only
artifacts/                    generated evidence only
docs/                         canonical policy and architecture notes
scripts/                      repo automation, registries, and current guard rails
```

## Rules That Matter

- This pass is frontend-only. Do not build ACP host logic, provider runtime logic, or backend features here.
- `apps/desktop` and `apps/mobile` are shells only. Shared behavior belongs in `packages/`.
- `packages/app-client` owns future transport-facing frontend capability clients.
- `packages/app-core` owns future framework-neutral reducers, selectors, and view-model logic.
- `packages/design-system-tokens`, `packages/design-system-desktop`, and `packages/design-system-mobile` reserve the UI boundary. Do not add primitives, themes, or tokens yet.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- No raw DOM or React Native primitives belong in feature code. That boundary is reserved for the design-system packages.

Canonical detail lives in `ARCHITECTURE.md`, `AGENTS.md`, `docs/contributing.md`, and `docs/frontend-architecture.md`.
