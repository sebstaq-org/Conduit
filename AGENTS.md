# Conduit Agent Notes

Use `rtk` as the shell-command prefix when operating in this repo. Keep all new JS or TS source in TypeScript and keep backend work out of this frontend shell-init pass unless the task explicitly says otherwise.

## Repo Rules

- Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- `apps/desktop` and `apps/mobile` are runnable shells only.
- Shared frontend behavior belongs in `packages/app-client` or `packages/app-core`, not directly in `apps/*`.
- Apps may depend on packages, but they must not import each other or reach into backend internals directly.
- Do not create placeholder UI, starter components, starter themes, fake tokens, or speculative feature stubs.

## Frontend Hard Rules

- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Feature code must not import raw DOM or React Native primitives directly. That boundary is reserved for design-system and shell code.
- Future backend contract usage belongs behind `packages/app-client`, not in app or feature code.
- Shared semantics should be defined once and rendered separately for desktop and mobile.

## Current Intent

This pass is about runnable shell setup, rules, workspace shape, and guard-rail surfaces. It is not a product UI pass.

Official ACP only remains product policy. In this pass that means boundary reservation and provenance only, not ACP host or provider-runtime implementation.

Rust under `backend/service/` is governed by the Rust-specific policy in `backend/service/AGENTS.md`. Treat that file as authoritative for how Rust may be written in Conduit.

Rust is hard-default: workspace lints are blocking, docs warnings are errors in the root suite, broad lint suppressions are forbidden, and crate-edge violations fail structure checks. The repo guardrail crate under `backend/service/crates/repo-guard` is fully bound by the same Rust rules and gets no policy carve-outs.
