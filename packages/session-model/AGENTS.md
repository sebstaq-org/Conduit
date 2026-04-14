# Session Model Guidance

This package owns platform-neutral session/provider read-side types.

- Keep it free of transport, UI, proof artifacts, React, React Native, Electron, and process APIs.
- Keep ACP-compatible naming where the data is ACP truth.
- New read-model contracts with runtime boundaries must expose Zod schemas as the source of truth and infer their TypeScript types from those schemas.
- Provider snapshots, raw wire events, and prompt lifecycle snapshots are diagnostic/provider truth unless a stable frontend read-model exposes them through `src/app-state`.
- Do not add command dispatch, persistence, or provider runtime logic here.
