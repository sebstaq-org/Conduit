# Conduit

Conduit contains the Phase 1.5 official-ACP-only consumer API baseline on top of the Phase 0.5 bootstrap. The backend pins the official ACP contract bundle, discovers only official adapter binaries, exposes the locked session subset through `service-runtime`, serves the normal product boundary over `service-bin serve` WebSocket, and keeps manual proof artifacts isolated from normal runtime.
The frontend workspace has one Expo/React Native app under `apps/frontend`; Electron hosts that app web target instead of owning a separate UI. `packages/session-client` and `packages/session-contracts` own the normal consumer boundary; `packages/app-client`, `packages/app-core`, and `packages/design-system-tokens` keep shared non-UI package boundaries.

## Happy Path

1. `rtk pnpm install`
2. `rtk pnpm run bootstrap`
3. `rtk pnpm run check`

## Frontend Structure

```text
apps/          frontend app and desktop host
packages/      shared frontend packages
backend/       Rust service workspace and future backend-owned assets
vendor/        pinned external sources only
artifacts/     generated evidence only
docs/                         canonical policy and architecture notes
scripts/       frontend registries only; repo guard rails live in backend/service/crates/repo-guard
```

## Rules That Matter

- Official ACP only is policy: official schema/meta are the contract source and official adapter binaries are the only runtime endpoints.
- The normal consumer transport is `rtk cargo run --quiet --locked --manifest-path backend/service/Cargo.toml -p service-bin -- serve`, which exposes versioned WebSocket frames at `ws://127.0.0.1:4174/api/session`.
- `backend/` is the only backend root. Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- New JS or TS source stays in TypeScript.
- Rust is blocking by default: curated workspace lints, `clippy -D warnings`, `rustdoc -D warnings`, and crate-edge structure checks all run in the root suite.
- Apps talk through packages and the app API boundary, never by reaching into backend internals.
- `artifacts/` and `vendor/` hold generated or pinned evidence, not hand-authored runtime code; volatile proof workspaces are ignored.
- `apps/frontend` owns the product UI app for native and web. `apps/desktop` hosts the web target only.
- `packages/session-client` and `packages/session-contracts` own normal runtime command transport and envelopes.
- `packages/app-client` owns proof-surface contracts only.
- `packages/app-core` owns provider/session vocabulary and framework-neutral view-model logic.
- App UI tokens and primitives live under `apps/frontend/src/ui` until a second real consumer justifies extraction.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- No raw DOM or React Native primitives belong in feature code. That boundary is reserved for app UI primitives and shell code.

Canonical detail lives in `ARCHITECTURE.md`, `AGENTS.md`, `docs/contributing.md`, and `docs/frontend-architecture.md`.
