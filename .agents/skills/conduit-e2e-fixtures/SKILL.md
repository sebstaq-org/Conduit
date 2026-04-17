---
name: conduit-e2e-fixtures
description: "Conduit E2E fixture workflow. Use when adding provider capture CLI support, adding or extending provider-fixture mock endpoints, or adding Playwright E2E tests that must run the real Conduit backend/UI against fixture-backed ACP providers."
---

# Conduit E2E Fixtures

Use this skill whenever work touches the fixture pipeline for Conduit E2E: capture CLI, provider-fixture mock endpoints, or Playwright tests under `apps/e2e`.

## Hard Rules

- Prefix every shell command with `rtk`.
- ACP is the source of truth. Model provider-facing payloads after the official ACP contract; do not invent product-specific shortcuts at the provider boundary.
- Keep the layers separate: capture CLI captures provider data, `provider-fixture` replays curated provider fixtures, and E2E tests drive the real product through `service-bin` and the UI.
- E2E must use the mock provider through `service-bin --provider-fixtures`; do not mock WebSocket responses, app-client state, service-runtime, SQLite rows, React components, or UI state.
- Mock provider endpoints may only use curated fixtures with capture-CLI lineage. Do not hand-author provider truth from memory, inline fixture responses in Rust, or make tests pass from data that never came through the CLI workflow.
- Do not commit raw manual captures, logs, transcripts, screenshots, local paths from private machines, account metadata, secrets, tokens, prompts, or provider output that has not been reviewed and minimized.
- Curated fixtures must be sanitized, minimal, deterministic, and public-safe. If sensitive fields are replaced with synthetic values, document that curation in the manifest and keep the ACP shape from the CLI capture.
- Use an isolated service store for E2E with `--store-path`; never let E2E mutate the product local store.
- Keep one source of parsing/normalization truth. If the app already has transcript/content handling, reuse or move that shared logic instead of duplicating a second parser for tests.

## Boundary Model

The intended flow is:

```text
capture CLI -> reviewed raw material -> curated provider fixture
curated provider fixture -> provider-fixture crate -> service-bin --provider-fixtures
Playwright -> real Expo Web UI -> real WebSocket API -> real service-runtime -> mock provider
```

Do not replace this with product-observation fixtures unless the user explicitly changes the strategy. The default E2E strategy is provider-level mocking only.

## Adding Capture CLI Support

Add capture support in `backend/service/crates/conduit-cli` only when a new provider ACP operation is needed as fixture source material.

Do:

- Route through the same provider/backend code path the product uses for that operation.
- Preserve ACP naming and payload shape, for example `session/list`, `session/load`, `session/new`, or `session/prompt`.
- Write captures into the established capture output shape: manifest, raw provider data, normalized data when applicable, and ledger/proof metadata.
- Validate the captured payload enough that bad captures fail loudly.
- Keep capture commands short and human-runnable through the `conduit` CLI.

Do not:

- Add scripts as substitutes for CLI commands.
- Capture by reading private provider files directly unless that is already the product code path for the provider.
- Convert ACP payloads into product UI payloads in the capture CLI.
- Commit raw capture outputs unless the user explicitly asks and the data is reviewed as public-safe.

## Adding A Mock Provider Endpoint

Add replay support in `backend/service/crates/provider-fixture` when E2E needs the backend to call a provider operation deterministically.

Do:

- Load endpoint fixtures from the provider fixture root, usually under `apps/e2e/fixtures/provider/<provider>/<operation>/...`.
- Keep the fixture shape close to the provider result captured by CLI, with only documented curation/sanitization changes.
- Return errors for missing required fixtures when the operation is explicitly used; do not silently invent successful provider responses.
- Add focused provider-fixture tests for fixture loading, malformed fixtures, missing fixtures, and the provider-port method.
- Keep provider support scalable across `codex`, `claude`, `copilot`, and future providers by keying on `ProviderId` and shared fixture conventions.

Do not:

- Put E2E-only branching into product runtime code.
- Encode fixture responses inline in Rust when they belong in fixture files.
- Make the mock provider smarter than the fixture contract. It should replay deterministic provider behavior, not simulate an agent.
- Add fallback behavior that makes tests pass when a fixture is missing or malformed.

## Adding An E2E Test

Add tests under `apps/e2e/tests` and use the shared harness in `apps/e2e/src/harness.ts` unless the harness itself needs a deliberate extension.

Do:

- Start the real `service-bin` binary with `--provider-fixtures <fixture-root>` and `--store-path <temporary sqlite>`.
- Start the real Expo Web frontend with `EXPO_PUBLIC_CONDUIT_SESSION_WS_URL` pointing at that service.
- Seed product state only through public runtime commands over WebSocket, such as `projects/add` or settings commands.
- Assert visible UI outcomes that prove the intended chain ran through list/open/load/prompt/render, using stable sentinel text where useful.
- Keep each first-pass test narrow: one product flow, one provider endpoint behavior, one clear assertion target.

Do not:

- Seed SQLite directly.
- Stub frontend network calls.
- Reach into app internals from Playwright.
- Assert only that the page loaded or that no exception occurred.
- Use real provider credentials or live provider processes in E2E.

## Validation

For E2E fixture changes, run the focused checks that match the touched layers:

```bash
rtk pnpm --filter @conduit/e2e run typecheck
rtk cargo test --manifest-path backend/service/Cargo.toml -p service-bin -p provider-fixture
rtk cargo clippy --manifest-path backend/service/Cargo.toml -p service-bin -p provider-fixture --all-targets --all-features -- -D warnings
rtk pnpm --filter @conduit/e2e run test
```

If capture CLI code changed, also run the relevant `conduit-cli` tests. If frontend resolver or UI code changed, run the frontend checks required by the repo for that surface.

Before committing, run `rtk git status --short` and ensure no Playwright artifacts, raw captures, screenshots, or manual logs are staged.
