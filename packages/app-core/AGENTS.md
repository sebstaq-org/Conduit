# App Core Guidance

This package is a compatibility re-export boundary for framework-neutral data.

- Keep it free of React, React Native, Electron, DOM APIs, and process APIs.
- New session/provider contracts belong in `@conduit/session-contracts` and `@conduit/session-model`.
- Do not add tokens, primitives, transport code, or placeholder feature state yet.
