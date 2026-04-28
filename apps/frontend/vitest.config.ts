import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const workspaceAliases = {
  "@": resolve(import.meta.dirname, "src"),
  "@conduit/app-client": resolve(
    import.meta.dirname,
    "../../packages/app-client/src/index.ts",
  ),
  "@conduit/app-core": resolve(
    import.meta.dirname,
    "../../packages/app-core/src/index.ts",
  ),
  "@conduit/app-protocol": resolve(
    import.meta.dirname,
    "../../packages/app-protocol/src/index.ts",
  ),
  "@conduit/design-system-tokens": resolve(
    import.meta.dirname,
    "../../packages/design-system-tokens/src/index.ts",
  ),
  "@conduit/session-client": resolve(
    import.meta.dirname,
    "../../packages/session-client/src/index.ts",
  ),
  "@conduit/session-contracts": resolve(
    import.meta.dirname,
    "../../packages/session-contracts/src/index.ts",
  ),
  "@conduit/session-model": resolve(
    import.meta.dirname,
    "../../packages/session-model/src/index.ts",
  ),
  "@sentry/react-native": resolve(
    import.meta.dirname,
    "test/sentry-react-native.mock.ts",
  ),
};

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
