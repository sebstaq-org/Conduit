# Frontend App Guidance

This directory owns the Conduit UI app for React Native, React Native Web, and the Electron-hosted web surface.

- Keep app UI components, tokens, screens, and local features under `src/`.
- Frontend styling should be Restyle theme-prop driven through `src/theme`; do not introduce `StyleSheet` or raw hex colors outside the theme contract.
- Future shared session capability behavior belongs in `@conduit/session-client`, `@conduit/session-contracts`, or `@conduit/session-model`.
- Raw React Native primitives belong in app UI primitives or shell integration, not in feature composition.
