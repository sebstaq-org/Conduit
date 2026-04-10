# Conduit Agent Notes

Use `rtk` as the shell-command prefix when operating in this repo. Keep all new JS or TS source in TypeScript, use `backend/` instead of `native/`, and stay inside Phase 0.5 unless the task explicitly moves to Phase 1.

Do not introduce top-level `rust`, `shared`, `core`, `utils`, `misc`, or `tmp`. Apps may depend on packages, but they must not import other apps or reach into backend internals directly.

Official ACP only is policy. In Phase 0.5 that means boundary reservation, provenance pinning, and guard rails, not ACP host or provider-runtime implementation.

Rust under `backend/service/` is governed by the Rust-specific policy in `backend/service/AGENTS.md`. Treat that file as authoritative for how Rust may be written in Conduit.

Rust is hard-default: workspace lints are blocking, docs warnings are errors in the root suite, broad lint suppressions are forbidden, and crate-edge violations fail structure checks. The repo guardrail crate under `backend/service/crates/repo-guard` is fully bound by the same Rust rules and gets no policy carve-outs.
