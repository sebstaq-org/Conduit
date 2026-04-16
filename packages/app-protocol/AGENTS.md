# App Protocol Guidance

This package owns the shared UI<>backend protocol boundary for Conduit.

- Generated protocol types and validators belong here, not in app code.
- Only client or adaptation layers may depend on this package directly.
- Do not add React, React Native, Electron, app-state, proof orchestration, or feature logic here.
- Keep ACP-compatible naming where the protocol is ACP truth.
- Do not introduce hand-written fallback DTO families, deprecated aliases, or compatibility shims.
