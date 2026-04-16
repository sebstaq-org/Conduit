# Frontend App Guidance

This directory owns the Conduit UI app for React Native, React Native Web, and the Electron-hosted web surface.

- Keep app UI components, tokens, screens, and local features under `src/`.
- Frontend styling should be Restyle theme-prop driven through `src/theme`; do not introduce raw hex colors outside the theme contract.
- Redux Toolkit is the frontend global-state platform. RTK Query is the only frontend path for backend read-model fetching and caching.
- Feature modules must not perform direct transport, fetch, WebSocket, or backend command dispatch. Add RTK Query endpoints under `src/app-state` and consume generated hooks from features.
- `src/app-state` is the frontend async data boundary and the only allowed app-facing import surface for feature and screen code.
- Treat `src/app-state/README.md` as the product-facing session data contract. If a backend capability is not exposed there, feature UI must not consume it directly.
- Do not add Zustand, ad hoc stores, or feature-local global state containers unless the state boundary is explicitly revisited.
- `@conduit/app-protocol` is not a frontend feature API. Only adaptation layers may import it directly.
- Raw React Native primitives belong in app UI primitives or shell integration, not in feature composition.
