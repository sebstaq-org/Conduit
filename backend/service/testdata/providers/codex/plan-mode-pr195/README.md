# Codex ACP Plan-Mode Proof (PR195)

This directory is the canonical Conduit-owned proof pack for Codex ACP plan-mode
wire observations tied to the `codex-acp` PR195 workstream.

## Scope

- Provider scope: Codex via official ACP adapter.
- Conduit scope: wire capture and evidence normalization readiness only.
- Out of scope: product UI behavior and composer product logic.

## Canonical files

- `proof-matrix.md` - human-readable row-by-row verdicts for Codex ACP scope.
- `proof-index.json` - machine-readable mapping from proof row to capture, command, and evidence.
- `run-manifest.json` - run provenance, adapter provenance, and reproducible command surface.
- `fixtures/` - minimal curated payload excerpts used by proof-index rows.
- `thread-lens-reference/` - secondary supporting references copied into Conduit.

## Capture provenance

Primary captures are sourced from manual phase-2 runs under the Conduit artifacts
workspace (`codex-live-observation`), identified by run id:

- `codex-plan-wire-proof-refactored-pr195-20260415T222911Z`
- `codex-acp-direct-probe-refactored-pr195-20260416T064922Z`
- `codex-acp-direct-probe-refactored-pr195-interactions-20260416T065726Z`
- `codex-acp-direct-probe-refactored-pr195-edgecases-20260416T081650Z`
- `codex-prb-backend-interaction-20260416T100116Z`
- `codex-prb-backend-interaction-20260416T101057Z`
- `codex-prb-backend-interaction-20260416T123111Z`
- `codex-acp-terminal-plan-meta-20260416T221545Z`

PR B backend bridge live-delta curation is captured in:

- `fixtures/backend-interaction-bridge-live.json`
- `fixtures/terminal-plan-meta.json`

Thread Lens references are copied into `thread-lens-reference/` as secondary
shape evidence only. They are not the canonical source of truth for Conduit
proof gates.

## Sanitization constraints

- Do not commit raw unsanitized logs.
- Keep only minimal payload excerpts needed to prove each row.
- Do not include secrets, tokens, or account data.
- Prefer run ids over absolute local machine paths when documenting provenance.
