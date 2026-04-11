# Phase 1.5 Checkpoint 2: Shared Session Contracts And Client

This proof covers the second Phase 1.5 checkpoint: adding platform-neutral `packages/session-model`, `packages/session-contracts`, and `packages/session-client`.

`session-model` owns provider/session read-side vocabulary. `session-contracts` owns transport-neutral consumer command envelopes and keeps ACP command names exact for `initialize`, `session/new`, `session/list`, `session/load`, `session/prompt`, and `session/cancel`. `session-client` owns transport mechanics and does not import UI, proof artifacts, desktop, or mobile code.

Desktop and mobile now import the same `@conduit/session-client` boundary for provider vocabulary, command names, and the official-ACP-only client policy. Mobile no longer imports `createDesktopProofClient`.

The remaining `DesktopProof*` types are isolated to the proof-oriented desktop/app-client path and are not exported by the new normal session packages.

Verification commands are listed in `command.txt`; combined command output is captured in `stdout.log` and `stderr.log`.
