import { defineConfig } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

const workspaceAliases = {
  "@conduit/app-client": resolve(
    import.meta.dirname,
    "../../packages/app-client/src/index.ts",
  ),
  "@conduit/app-core": resolve(
    import.meta.dirname,
    "../../packages/app-core/src/index.ts",
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
};

const main = {
  build: {
    externalizeDeps: false,
  },
  resolve: {
    alias: workspaceAliases,
  },
};

const preload = {
  build: {
    externalizeDeps: false,
  },
  resolve: {
    alias: workspaceAliases,
  },
};

export default defineConfig({
  main,
  preload,
  renderer: {
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src/renderer"),
        "@conduit/app-client": workspaceAliases["@conduit/app-client"],
        "@conduit/app-core": workspaceAliases["@conduit/app-core"],
        "@conduit/design-system-tokens":
          workspaceAliases["@conduit/design-system-tokens"],
        "@conduit/session-client": workspaceAliases["@conduit/session-client"],
        "@conduit/session-contracts":
          workspaceAliases["@conduit/session-contracts"],
        "@conduit/session-model": workspaceAliases["@conduit/session-model"],
      },
    },
    plugins: [react()],
  },
});
