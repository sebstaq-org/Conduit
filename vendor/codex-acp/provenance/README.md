# Codex ACP Provenance

This directory records the reviewable delta behind Conduit's vendored Codex ACP adapter.

- `upstream-pr195.patch` is the aggregate upstream PR 195 diff from `be20828` to `4ae9064c922c1b06d7b1eef08a9502c8cd9326da`, limited to the vendored adapter source files.
- `conduit-local.patch` is the additional local dirty delta that existed in `/srv/devops/repos/vendor/codex-acp-pr195` when Conduit vendored the adapter.

The vendored source in `vendor/codex-acp/src` is the canonical build input. These patches are for review, audit, and future rebases; do not apply them on top of the current vendored tree without first restoring the matching upstream base.
