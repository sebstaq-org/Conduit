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
- `apps/frontend/src/screens/navigation-panel` is composition-only: it may arrange panel sections and temporary local fixtures, but feature behavior and state must move to narrow feature modules when introduced.
- When a UI or app task is finished, start the relevant app and open it for the
  user so they can test it immediately. "Started" means the whole relevant local
  stack is usable: if the UI flow depends on service WebSocket/API data, start
  that service too and manually verify the target flow is not stuck in an
  unavailable/offline state before handing it over.

## Session View Rules

The session view is expected to grow into a large product surface: transcript
rows, thoughts, tool calls, events, composer, active run state, approvals,
interactions, pagination, and live sync all belong there over time. Do not hide
that complexity by creating one broad `session-detail` feature, component, or
state slice that owns the whole surface.

Model the backend-facing session data as a stable projection behind
`packages/app-client` / `packages/app-core`, then render it through narrow
frontend features. Good initial boundaries are transcript/timeline rendering,
composer, tool-call rendering, thought/event rendering, active-run state,
approval or interaction handling, and live/pagination sync.

`apps/frontend/src/screens/session` should compose those pieces. It may hold
screen layout and temporary empty or loading states, but feature behavior,
transport, parsing, and long-lived state must move into narrower modules as soon
as they exist.

## Current Intent

This pass is about the React Native Web frontend foundation, rules, workspace shape, and the first navigation panel screen composition.

Official ACP only remains product policy. In this pass that means boundary reservation and provenance only, not ACP host or provider-runtime implementation.

Rust under `backend/service/` is governed by the Rust-specific policy in `backend/service/AGENTS.md`. Treat that file as authoritative for how Rust may be written in Conduit.

Rust is hard-default: workspace lints are blocking, docs warnings are errors in the root suite, broad lint suppressions are forbidden, and crate-edge violations fail structure checks. The repo guardrail crate under `backend/service/crates/repo-guard` is fully bound by the same Rust rules and gets no policy carve-outs.

## Repo-Local Skills

Use `$conduit-pr-green` from `.agents/skills/conduit-pr-green` when creating or updating Conduit pull requests. It defines the required PR body style and the rule that agents must poll GitHub until the PR is merge-clean and all checks are completed green.
