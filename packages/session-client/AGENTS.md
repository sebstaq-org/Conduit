# Session Client Guidance

This package owns platform-neutral consumer transport mechanics.

- Keep it free of UI, proof artifact orchestration, React, React Native, Electron, and provider runtime logic.
- It may know how to send `session-contracts` envelopes over a selected transport.
- It must not create alternate live DTO families or rename ACP commands.
