# App Core Guidance

This package is a framework-neutral app-facing layer.

- Keep it free of React, React Native, Electron, DOM APIs, and process APIs.
- Do not re-export protocol or wire contracts from here.
- Do not add tokens, primitives, transport code, or placeholder feature state here.
