# Desktop Shell Guidance

This directory is reserved for Electron shell and desktop integration only.

- Do not add shared feature logic here.
- Do not add shared UI primitives here.
- Use `@conduit/session-client` or `@conduit/app-client` as the desktop-facing boundaries; do not import `@conduit/app-protocol` directly from shell code.
- Raw desktop primitives and Electron integration belong here only when shell work actually requires them.
