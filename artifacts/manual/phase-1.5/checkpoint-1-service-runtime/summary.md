# Phase 1.5 Checkpoint 1: Service Runtime Boundary

This proof covers the first Phase 1.5 checkpoint: adding `backend/service/crates/service-runtime` as the Rust consumer API boundary above `app-api`.

The runtime dispatches the locked ACP command names `initialize`, `session/new`, `session/list`, `session/load`, `session/prompt`, and `session/cancel`, plus Conduit-owned `provider/snapshot`, `provider/disconnect`, and `events/subscribe`.

The new crate is registered in the Cargo workspace and repo-guard approved crate list. Repo-guard also enforces that `service-runtime` only depends on `app-api` and ACP-facing crates, blocking upward or provider-specific runtime dependencies.

Its tests use an in-memory provider port to verify command dispatch, provider reuse, unknown provider errors, disconnect behavior, snapshot access, and raw event access without moving proof/artifact behavior into the runtime boundary.

Verification commands are listed in `command.txt`; combined command output is captured in `stdout.log` and `stderr.log`.
