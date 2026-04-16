# Testdata

`providers/` contains real official-adapter protocol captures copied from isolated Phase 1 proof runs and curated replay fixtures derived from manual live observations. `failures/` contains synthetic transport-only fixtures for cases that are not provider semantics, and `golden/` contains Conduit-owned projections over the real captures.

Do not hand-author provider truth here. Refresh provider captures from `/srv/devops/repos/conduit-artifacts/manual/phase-1/<provider>/...` after isolated proof runs, and keep replay fixtures tied to their `/srv/devops/repos/conduit-artifacts/manual/phase-2/...` capture source.

## Canonical Codex plan-mode proof pack

Codex PR195 plan-mode proof is canonicalized under:

- `providers/codex/plan-mode-pr195/`

Use this directory as the only source of truth for Codex ACP A-gate decisions.
Legacy notes or external docs may exist, but gating decisions should be made from
the canonical matrix/index in this directory.
