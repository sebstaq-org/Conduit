# Conduit

Conduit is in a frontend shell-init pass. This pass turns `apps/desktop` and `apps/mobile` into real Electron and Expo shells while keeping product UI, design tokens, primitives, themes, and features out of scope.

## Happy Path

1. `rtk pnpm install`
2. `rtk pnpm run bootstrap`
3. `rtk pnpm run check`

## Frontend Structure

```text
apps/          desktop and mobile shells
packages/      shared frontend packages and design-system boundaries
backend/       Rust service workspace and future backend-owned assets
vendor/        pinned external sources only
artifacts/     generated evidence only
docs/                         canonical policy and architecture notes
scripts/       frontend registries only; repo guard rails live in backend/service/crates/repo-guard
```

## Rules That Matter

- This pass is frontend-only. Do not build ACP host logic, provider runtime logic, or backend features here.
- `apps/desktop` and `apps/mobile` are runnable shells only. Shared behavior belongs in `packages/`.
- `packages/app-client` owns future transport-facing frontend capability clients.
- `packages/app-core` owns future framework-neutral reducers, selectors, and view-model logic.
- `packages/design-system-tokens`, `packages/design-system-desktop`, and `packages/design-system-mobile` reserve the UI boundary. Do not add primitives, themes, or tokens yet.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- No raw DOM or React Native primitives belong in feature code. That boundary is reserved for the design-system packages.

Canonical detail lives in `ARCHITECTURE.md`, `AGENTS.md`, `docs/contributing.md`, and `docs/frontend-architecture.md`.
