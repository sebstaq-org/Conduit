# Conduit

Conduit now contains the Phase 1 official-ACP-only baseline on top of the Phase 0.5 bootstrap. The backend pins the official ACP contract bundle, discovers only official adapter binaries, owns raw JSON-RPC over stdio, exposes the locked session subset through the app API, and writes isolated manual proof artifacts.

## Happy Path

1. `rtk pnpm install`
2. `rtk pnpm run bootstrap`
3. `rtk pnpm run check`

## Structure

```text
apps/          desktop and mobile shells
packages/      shared TypeScript packages
backend/       Rust service workspace and future backend-owned assets
vendor/        pinned external sources only
artifacts/     generated evidence only
docs/          repo policy and contributor guidance
scripts/       reserved top-level helper root; repo guard rails live in backend/service/crates/repo-guard
```

## Rules That Matter

- Official ACP only is policy: official schema/meta are the contract source and official adapter binaries are the only runtime endpoints.
- `backend/` is the only backend root. Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- New JS or TS source stays in TypeScript.
- Rust is blocking by default: curated workspace lints, `clippy -D warnings`, `rustdoc -D warnings`, and crate-edge structure checks all run in the root suite.
- Apps talk through packages and the app API boundary, never by reaching into backend internals.
- `artifacts/` and `vendor/` hold generated or pinned evidence, not hand-authored runtime code; volatile proof workspaces are ignored.

More detail lives in `ARCHITECTURE.md`, `AGENTS.md`, and `docs/contributing.md`.
