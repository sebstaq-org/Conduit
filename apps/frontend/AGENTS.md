# Frontend App Guidance

This directory owns the Conduit UI app for React Native, React Native Web, and the Electron-hosted web surface.

- Keep app UI components, tokens, screens, and local features under `src/`.
- Frontend styling should be Restyle theme-prop driven through `src/theme`; do not introduce raw hex colors outside the theme contract.
- Redux Toolkit is the frontend global-state platform. RTK Query is the only frontend path for backend read-model fetching and caching.
- Feature modules must not perform direct transport, fetch, WebSocket, or backend command dispatch. Add RTK Query endpoints under `src/app-state` and consume generated hooks from features.
- `src/app-state` is the frontend async data boundary for RTK Query query functions; do not copy that async transport pattern into feature modules.
- Treat `src/app-state/README.md` as the product-facing session data contract. If a backend capability is not exposed there as an RTK Query hook, feature UI must not consume it directly.
- Do not add Zustand, ad hoc stores, or feature-local global state containers unless the state boundary is explicitly revisited.
- Shared session capability behavior belongs in `@conduit/session-client`, `@conduit/session-contracts`, or `@conduit/session-model`.
- Raw React Native primitives belong in app UI primitives or shell integration, not in feature composition.
