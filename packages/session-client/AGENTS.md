# Session Client Guidance

This package owns platform-neutral consumer transport mechanics.

- Keep it free of UI, proof artifact orchestration, React, React Native, Electron, and provider runtime logic.
- It may know how to send `session-contracts` envelopes over a selected transport.
- Its root export is the stable product client surface. Do not re-export raw transport commands, raw events, provider snapshots, proof models, or diagnostic DTOs from here.
- It must not create alternate live DTO families or rename ACP commands.
