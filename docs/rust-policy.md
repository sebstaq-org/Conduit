# Rust Policy

Conduit uses a deny-first Rust policy. If a rule is ambiguous between "allow sometimes" and "forbid", the default is forbid.

## Toolchain And Workspace

- `backend/service/rust-toolchain.toml` is mandatory.
- The Rust workspace requires `edition = "2024"`, `resolver = "3"`, and explicit `rust-version`.
- Every crate under `backend/service/crates/` must inherit `edition.workspace = true`, `rust-version.workspace = true`, and `[lints] workspace = true`.
- `backend/service/crates/repo-guard` is not a tooling carve-out; it must satisfy the same workspace policy as every other crate.
- Custom cfgs are forbidden until explicitly introduced and registered through workspace lint policy.

## Safety

- `unsafe` is forbidden.
- `unsafe_op_in_unsafe_fn`, `missing_unsafe_on_extern`, `unsafe_attr_outside_unsafe`, and `static_mut_refs` are deny-level.
- FFI is forbidden. No `extern` blocks, `extern "C"` functions, bindgen output, or global mutable statics belong in the repo without a separate policy change.

## Lints And Suppressions

- `cargo clippy -- -D warnings` is the minimum baseline; Conduit adds curated deny-level rustc and Clippy lints beyond that.
- `#[expect(..., reason = "...")]` is the default suppression mechanism.
- `#[allow(...)]` is reserved for cases where `expect` cannot express the exception.
- Crate-wide or module-wide suppressions are forbidden, including outer attrs on modules.
- Stale expectations are forbidden through `unfulfilled_lint_expectations = "deny"`.
- Direct stdout/stderr emission is forbidden everywhere, including binaries and tooling crates.

## Documentation

- Every crate root must have crate-level docs.
- Public items must be documented.
- Public APIs must document `Errors`, `Panics`, and `Safety` when relevant.
- Broken intra-doc links, private intra-doc links, bare URLs, and invalid Rust code blocks are deny-level failures.

## API And Errors

- API is private by default.
- Narrow `pub` is required. Public module dumps and wildcard re-exports are forbidden.
- Prefer sealed traits or narrow facades over open extension points.
- Recoverable failures return `Result`.
- `panic!` is only for invariants, bugs, tests, or examples.
- Public fallible APIs should use concrete error types that implement `std::error::Error`.
- Library crates may not depend on `anyhow`, `eyre`, or similar generic app-level error aggregators.

## Tests And Readability

- Unit tests belong next to the code they cover.
- Integration tests belong in `tests/`.
- Doctests are the required form for public examples.
- Rust source and test files over 700 lines are forbidden.
- Function length, argument count, and cognitive complexity are bounded through Clippy config and deny-level lints. Split code instead of pleading special cases.

## Primary Sources

- Rust Reference: <https://doc.rust-lang.org/reference/>
- Rust Book: <https://doc.rust-lang.org/book/>
- Cargo Book: <https://doc.rust-lang.org/cargo/>
- rustc lint levels: <https://doc.rust-lang.org/rustc/lints/levels.html>
- rustdoc lints: <https://doc.rust-lang.org/rustdoc/lints.html>
- rustdoc documentation guide: <https://doc.rust-lang.org/rustdoc/how-to-write-documentation.html>
- Edition Guide: <https://doc.rust-lang.org/edition-guide/>
- Rust API Guidelines: <https://rust-lang.github.io/api-guidelines/>
- rustfmt project docs: <https://github.com/rust-lang/rustfmt>
