# Conduit

Conduit is an official-ACP-only workspace. The backend validates against a pinned ACP bundle, discovers only official adapter binaries, and exposes a versioned consumer WebSocket boundary from `service-bin serve`. The frontend product UI lives in `apps/frontend`; Electron in `apps/desktop` hosts that same web target.

## Happy Path

1. `rtk pnpm install`
2. `rtk pnpm run bootstrap`
3. `rtk pnpm run check`

## Frontend Structure

```text
apps/          frontend app and desktop host
packages/      shared frontend packages
backend/       Rust service workspace
vendor/        pinned external sources only
artifacts/     generated evidence only
docs/          canonical policy and architecture notes
scripts/       stage operations and repository checks
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
- App UI tokens and primitives live under `apps/frontend/src/ui`.
- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- No raw DOM or React Native primitives belong in feature code. That boundary is reserved for app UI primitives and shell code.

## Isolated Stage Build

`scripts/stage/conduit-stage.sh` builds an isolated, tagged stage bundle from `origin/main` under `/srv/devops/repos/conduit-stage` and keeps runtime processes separate from repo-local Expo or Electron runs.

1. `rtk pnpm run stage:refresh`
2. `rtk pnpm run stage:open`
3. `rtk pnpm run stage:install-desktop-entry` (optional launcher icon)

The stage runtime defaults to backend `ws://127.0.0.1:4274/api/session` and web `http://127.0.0.1:4310`, with isolated app data in `/srv/devops/repos/conduit-stage/data`.

Canonical detail lives in `ARCHITECTURE.md`, `AGENTS.md`, and `docs/contributing.md`.
