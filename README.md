# Conduit

Conduit now contains the Phase 1.5 official-ACP-only consumer API baseline on top of the Phase 0.5 bootstrap. The backend pins the official ACP contract bundle, discovers only official adapter binaries, owns raw JSON-RPC over stdio, exposes the locked session subset through `service-runtime`, serves the normal product boundary over `service-bin serve` WebSocket, and keeps manual proof artifacts isolated from normal runtime.
The frontend workspace uses the locked desktop/mobile foundation shape: `apps/*` are shells, `packages/session-client` and `packages/session-contracts` own the normal consumer boundary, `packages/app-client` remains proof-surface-only, `packages/app-core` owns framework-neutral vocabulary, and `packages/design-system-*` reserve UI boundaries without speculative product UI.

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

- Official ACP only is policy: official schema/meta are the contract source and official adapter binaries are the only runtime endpoints.
- The normal consumer transport is `rtk cargo run --quiet --locked --manifest-path backend/service/Cargo.toml -p service-bin -- serve`, which exposes versioned WebSocket frames at `ws://127.0.0.1:4174/api/session`.
- `backend/` is the only backend root. Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- New JS or TS source stays in TypeScript.
- Rust is blocking by default: curated workspace lints, `clippy -D warnings`, `rustdoc -D warnings`, and crate-edge structure checks all run in the root suite.
- Apps talk through packages and the app API boundary, never by reaching into backend internals.
- `artifacts/` and `vendor/` hold generated or pinned evidence, not hand-authored runtime code; volatile proof workspaces are ignored.
- `apps/desktop` contains the minimal Phase 1 proof surface; `apps/mobile` remains a shell entrypoint. Shared behavior belongs in `packages/`.
- `packages/session-client` and `packages/session-contracts` own normal runtime command transport and envelopes.
- `packages/app-client` owns proof-surface contracts only.
- `packages/app-core` owns provider/session vocabulary and framework-neutral view-model logic.
- `packages/design-system-tokens`, `packages/design-system-desktop`, and `packages/design-system-mobile` reserve the UI boundary. Do not add speculative primitives, themes, or fake tokens.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- No raw DOM or React Native primitives belong in feature code. That boundary is reserved for the design-system packages.

Canonical detail lives in `ARCHITECTURE.md`, `AGENTS.md`, `docs/contributing.md`, and `docs/frontend-architecture.md`.
