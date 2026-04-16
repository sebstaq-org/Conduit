# Rust Policy

This directory is a hard Rust zone. Follow these rules exactly.

## Baseline

- `edition = "2024"` is required through the workspace.
- `rust-version.workspace = true` is required for every crate.
- `rust-toolchain.toml` is mandatory and is the pinned toolchain source of truth.
- `[lints] workspace = true` is required for every crate.
- `backend/service/crates/repo-guard` is a normal workspace crate and gets no lint, docs, or structure exceptions.

## Safety

- `unsafe` is forbidden.
- `extern` blocks, `extern "C"` functions, FFI shims, and `static mut` are forbidden.
- Global mutable state is forbidden.
- If a future task genuinely requires `unsafe`, do not introduce it ad hoc. Stop and change policy first.

## Lints And Suppressions

- Warnings are errors.
- `unwrap`, `expect`, `todo!`, `dbg!`, and direct stdout/stderr emission are forbidden in non-test and test code.
- The default suppression form is `#[expect(..., reason = "...")]`.
- `#[allow(...)]` is reserved for cases where `expect` does not work.
- Broad suppressions are forbidden. Do not use crate-wide or module-wide `allow` or `expect`, including outer attrs on modules.

## Tracing

- Rust logging is `tracing` only. Do not introduce `log`, `env_logger`, `slog`, or similar alternatives.
- `service-bin` and `repo-guard` own `tracing-subscriber` initialization and must emit JSON logs.
- Command and worker runtime behavior must emit structured tracing events with stable fields (`event_name`, `source`, command/provider correlation, `ok`, `duration_ms`, and `error_code` when failed).
- Debug payload logging is allowed in dev/stage; default profile outside dev/stage is info unless explicitly overridden.

## API And Errors

- Default to private items. Use the smallest possible `pub` surface.
- Wildcard re-exports and public module dumps are forbidden.
- Public APIs must document `Errors`, `Panics`, and `Safety` when relevant.
- Recoverable failures return `Result`.
- `panic!` is only for invariants, bugs, tests, or examples.
- Library crates may not hide public errors behind `anyhow`, `eyre`, or similar catch-all error crates.

## Tests And Readability

- Unit tests stay near the code they cover.
- Integration tests belong in `tests/`.
- Doctests are required for public examples when examples exist.
- Oversized files, oversized tests, long functions, too many arguments, and high complexity are forbidden. Split modules instead of justifying them.

See `docs/rust-policy.md` for the normative reference and source links.
