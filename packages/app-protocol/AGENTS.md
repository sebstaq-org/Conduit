# App Protocol Package

This package owns generated backend-to-frontend protocol artifacts.

- Do not hand-edit `src/generated.ts`; run `pnpm run protocol:generate`.
- Only client and adaptation layers may import this package directly.
- Frontend feature code must consume app-facing models and services instead of these wire contracts.
