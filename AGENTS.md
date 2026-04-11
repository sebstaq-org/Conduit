# Conduit Agent Notes

Use `rtk` as the shell-command prefix when operating in this repo. Keep all new JS or TS source in TypeScript and keep backend work out of this frontend foundation pass unless the task explicitly says otherwise.

## Repo Rules

- This is a public repository. Treat every committed byte, including old
  artifacts and testdata, as world-readable.
- Never commit secrets or sensitive material: API keys, access tokens, OAuth
  tokens, bearer tokens, private keys, passwords, session cookies, credential
  files, private prompts, private user data, or unredacted environment dumps.
- Do not commit raw manual artifacts, transcripts, logs, screenshots, or
  provider captures unless they are explicitly curated for public use and
  reviewed for secrets, local paths, account metadata, and other sensitive data.
- Curated fixtures must be normalized and minimal. Prefer stable testdata over
  raw proof dumps, and document the capture source without exposing private
  machine details.
- Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`.
- `apps/frontend` owns the React Native and React Native Web UI app.
- `apps/desktop` is the Electron host only; it must not own product UI components.
- Shared backend-facing frontend behavior belongs in `packages/app-client` or `packages/app-core`, not directly in app feature code.
- Apps may depend on packages, but they must not import each other or reach into backend internals directly.
- Do not create placeholder UI, starter components, starter themes, fake tokens, or speculative feature stubs.

## Frontend Hard Rules

- Repo-authored frontend code must not use `useEffect`, `useLayoutEffect`, or `useInsertionEffect`.
- Feature code must not import raw DOM or React Native primitives directly. That boundary is reserved for `apps/frontend/src/ui` primitives and shell code.
- Future backend contract usage belongs behind `packages/app-client`, not in app or feature code.
- Product UI should be defined once in `apps/frontend` and hosted by platform shells.

## Current Intent

This pass is about the React Native Web frontend foundation, rules, workspace shape, and a temporary visual preview surface.

Official ACP only remains product policy. In this pass that means boundary reservation and provenance only, not ACP host or provider-runtime implementation.

Rust under `backend/service/` is governed by the Rust-specific policy in `backend/service/AGENTS.md`. Treat that file as authoritative for how Rust may be written in Conduit.

Rust is hard-default: workspace lints are blocking, docs warnings are errors in the root suite, broad lint suppressions are forbidden, and crate-edge violations fail structure checks. The repo guardrail crate under `backend/service/crates/repo-guard` is fully bound by the same Rust rules and gets no policy carve-outs.

## Repo-Local Skills

Use `$conduit-pr-green` from `.agents/skills/conduit-pr-green` when creating or updating Conduit pull requests. It defines the required PR body style and the rule that agents must poll GitHub until the PR is merge-clean and all checks are completed green.
