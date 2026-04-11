# Testdata

`providers/` contains real official-adapter protocol captures copied from isolated Phase 1 proof runs and curated replay fixtures derived from manual live observations. `failures/` contains synthetic transport-only fixtures for cases that are not provider semantics, and `golden/` contains Conduit-owned projections over the real captures.

Do not hand-author provider truth here. Refresh provider captures from `/srv/devops/repos/conduit-artifacts/manual/phase-1/<provider>/...` after isolated proof runs, and keep replay fixtures tied to their `/srv/devops/repos/conduit-artifacts/manual/phase-2/...` capture source.
