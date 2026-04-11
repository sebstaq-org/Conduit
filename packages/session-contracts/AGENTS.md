# Session Contracts Guidance

This package owns transport-neutral consumer command envelopes.

- Keep ACP command names exact where semantics match ACP.
- Only add Conduit-owned commands for behavior ACP does not define.
- Direct command construction and transport envelopes are not frontend product APIs. Product UI should consume them only through `@conduit/session-client` and `apps/frontend/src/app-state`.
- Do not add UI, proof artifact, provider runtime, or persistence logic here.
