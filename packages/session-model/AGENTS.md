# Session Model Guidance

This package owns platform-neutral session/provider read-side types.

- Keep it free of transport, UI, proof artifacts, React, React Native, Electron, and process APIs.
- Keep ACP-compatible naming where the data is ACP truth.
- Do not add command dispatch, persistence, or provider runtime logic here.
