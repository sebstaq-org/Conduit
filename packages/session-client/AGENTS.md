# Session Client Guidance

This package owns platform-neutral consumer transport mechanics.

- Keep it free of UI, proof artifact orchestration, React, React Native, Electron, and provider runtime logic.
- It may know how to send `session-contracts` envelopes over a selected transport.
- `src/client/` owns product-facing client adapters that translate stable client
  methods into contract commands and read-model responses.
- `src/transport/` owns transport adapters, WebSocket lifecycle, event callbacks,
  wire frame parsing, URL validation, and deferred request correlation.
- Its root export is the stable product client surface. Do not re-export raw transport commands, raw events, provider snapshots, proof models, or diagnostic DTOs from here.
- It must not create alternate live DTO families or rename ACP commands.
