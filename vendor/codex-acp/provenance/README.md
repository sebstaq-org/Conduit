# Codex ACP Provenance

This directory records historical reviewable delta behind Conduit's vendored Codex ACP adapter.

- `upstream-pr195.patch` is the aggregate upstream PR 195 diff from `be20828` to `4ae9064c922c1b06d7b1eef08a9502c8cd9326da`, limited to the vendored adapter source files.
- `conduit-local.patch` is the additional local dirty delta that existed in `/srv/devops/repos/vendor/codex-acp-pr195` when Conduit vendored the adapter.

The current vendored adapter has been rebased to upstream `v0.12.0` (`ee9418a65befdf08c3793d9a92dd4a083f545fcf`). These PR195 patches are retained for audit of the original plan-mode proof work; do not apply them on top of the current vendored tree without first restoring the matching PR195-era upstream base.
