# App Client Guidance

This package is the isolated desktop proof client boundary.

- Keep it free of React, React Native, Electron, and app-shell code.
- Normal runtime session transport belongs in `@conduit/session-client`, not here.
- Do not add reducers, view-model logic, primitives, or new normal consumer APIs here.
