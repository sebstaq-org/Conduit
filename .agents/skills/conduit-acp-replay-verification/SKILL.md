---
name: conduit-acp-replay-verification
description: "Conduit ACP replay verification workflow. Use when Codex needs to collect live provider proof through service-bin serve, document WebSocket/session snapshots/events, curate replay fixtures from real provider data, add or update replay integration tests, or extend Phase 2 replay coverage for Codex, Copilot, Claude, or another ACP provider in this repo."
---

# Conduit ACP Replay Verification

Use this skill for Conduit replay-fixture work that must prove real provider dataflow before implementation. Keep the order strict: live observation, proof notes, curated fixture, replay test, full validation.

## Hard Rules

- Prefix every shell command with `rtk`.
- Start with manual live observation through `service-bin serve`; do not implement or edit replay code before the observation and proof summary exist.
- Exercise the product boundary: `service-bin serve -> WebSocket /api/session -> service-runtime -> acp-core SDK host -> provider ACP adapter`.
- Send at least `initialize -> session/new -> session/prompt -> snapshot/get -> events/subscribe -> provider/disconnect`.
- Replay must sit at ACP/provider level. Do not mock `service-runtime`, `session-client`, WebSocket API, or snapshots.
- Use real provider output for curated fixtures. Normalize dynamic fields instead of inventing provider truth.
- Keep manual proof outside the repo under `/srv/devops/repos/conduit-artifacts/manual/phase-2/replay-fixtures-first-pass/<provider>-live-observation/`.
- Keep curated replay testdata under `backend/service/testdata/providers/<provider>/replay/...`; do not check raw manual proof into the repo.

## Live Observation

Start a clean server process for each provider so `events/subscribe after_sequence: 0` does not include an older provider run from the same process:

```bash
rtk cargo run --quiet --locked --manifest-path backend/service/Cargo.toml -p service-bin -- serve --host 127.0.0.1 --port <port>
```

Drive WebSocket `ws://127.0.0.1:<port>/api/session` with raw command frames shaped like:

```json
{
  "v": 1,
  "type": "command",
  "id": "<provider>-session-prompt-<unique>",
  "command": {
    "id": "<provider>-session-prompt-<unique>-command",
    "command": "session/prompt",
    "provider": "<provider>",
    "params": {
      "session_id": "<session id from session/new>",
      "prompt": "Reply exactly: conduit-phase-2-replay-<provider> observed."
    }
  }
}
```

Capture `transcript.json`, `raw-frames.jsonl`, `event-frames.jsonl`, `snapshot-after-prompt.json`, `snapshot-get.json`, `summary.json`, `summary.md`, and `command.txt`. The summary must state frame correlation, `snapshot.last_prompt.agent_text_chunks`, backlog event kinds from `events/subscribe`, live event frames after subscribe, ready/disconnected snapshot states, and normalization rules.

Expected event behavior: `events/subscribe` returns backlog events in the response and then emits those backlog events as WebSocket event frames; after `provider/disconnect`, the subscribed socket receives one additional `provider_disconnected` frame. If you reuse a server process, backlog can include prior runs, so restart before final proof.

If a provider fails mid-sequence, still save the same artifact set and make the failure explicit in `summary.md`. Do not curate a successful replay fixture from a failed observation. A prior Claude Phase 2 failure stopped at `session/prompt` because local auth/setup was incomplete; after fixing auth, the fresh Claude proof under `/srv/devops/repos/conduit-artifacts/manual/phase-2/replay-fixtures-first-pass/claude-live-observation/` reached prompt chunks, `events/subscribe`, and `provider/disconnect`, so use only the fresh successful run as the fixture source.

## Curated Fixture

Create a small scenario such as:

```text
backend/service/testdata/providers/<provider>/replay/
  manifest.json
  prompt-agent-text/
    scenario.json
    frames.jsonl
    expected-snapshot.json
    expected-events.jsonl
```

Include provider, scenario name, ACP protocol version, SDK dependency, capture source, redaction status, stable assertions, prompt input, real `agent_text_chunks`, final stop reason, and ignored dynamic fields. Normalize frame ids, command ids, timestamps, session ids, cwd, launcher executable/resolved paths, initialize elapsed time, provider versions, transport diagnostics, and exact event sequence values except cursor/backlog ordering.

## Replay Test

For a minimal first pass, add an integration test that starts the real `service-bin` binary with a temporary provider executable earlier in `PATH`. The temporary executable should speak stdio ACP from the curated fixture, stream `session/update` agent chunks during `session/prompt`, then return the final `PromptResponse`.

The test must connect by WebSocket and verify:

- response frame id equals request frame id and inner response id
- snapshot is `ready` after initialize
- snapshot is `disconnected` after provider/disconnect
- fixture text appears at `snapshot.last_prompt.agent_text_chunks`
- `events/subscribe` returns cursor/backlog and backlog frames are emitted
- live `provider_disconnected` is not a duplicate replay of backlog
- no live auth is required; remove provider API key env vars in the test process if relevant

## Validation

Run focused checks first:

```bash
rtk cargo test --manifest-path backend/service/Cargo.toml -p service-bin --test acp_replay
rtk cargo clippy --manifest-path backend/service/Cargo.toml -p service-bin --all-targets --all-features -- -D warnings
rtk pnpm run structure:check
```

Then run the full gate:

```bash
rtk pnpm run check
```

Before handoff, run a targeted secret sanity grep over the archived manual artifacts and curated testdata. Hits on variable names like `CODEX_API_KEY` may be provider auth-method labels, but actual token-like values must not be present.
