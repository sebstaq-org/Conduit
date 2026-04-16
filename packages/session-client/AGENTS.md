# Session Client Guidance

This package owns platform-neutral client and transport adaptation above the shared protocol boundary.

- Keep it free of UI, proof artifact orchestration, React, React Native, Electron, and provider runtime logic.
- It may depend on `@conduit/app-protocol`; feature code must not.
- `src/client/` owns product-facing client adapters that translate stable client methods into protocol commands and read-model responses.
- `src/transport/` owns transport adapters, WebSocket lifecycle, event callbacks, wire frame parsing, URL validation, and deferred request correlation.
- Its root export is the stable product client surface. Do not re-export raw transport internals or alternate DTO families from here.
