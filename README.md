# Conduit

Conduit Phase 0.5 bootstraps the repo for an official-ACP-only Phase 1 without locking in the ACP host or provider runtime too early. This repo contains the final top-level structure, pinned toolchains, workspace wiring, check entrypoints, structural guard rails, and empty artifact/testdata roots.

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
scripts/       repo automation and guard rails
```

## Rules That Matter

- Official ACP only is policy, but Phase 0.5 does not implement the ACP host or provider runtimes.
- `backend/` is the only backend root. Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- New JS or TS source stays in TypeScript.
- Rust is blocking by default: curated workspace lints, `clippy -D warnings`, `rustdoc -D warnings`, and crate-edge structure checks all run in the root suite.
- Apps talk through packages and the app API boundary, never by reaching into backend internals.
- `artifacts/` and `vendor/` hold generated or pinned evidence, not hand-authored runtime code.

More detail lives in `ARCHITECTURE.md`, `AGENTS.md`, and `docs/contributing.md`.
