# Session Contracts Guidance

This package owns transport-neutral consumer command envelopes.

- Keep ACP command names exact where semantics match ACP.
- Only add Conduit-owned commands for behavior ACP does not define.
- Do not add UI, proof artifact, provider runtime, or persistence logic here.
