import { defineConfig } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

const main = {
  build: {
    externalizeDeps: false,
  },
};

const preload = {
  build: {
    externalizeDeps: false,
  },
};

export default defineConfig({
  main,
  preload,
  renderer: {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
        "@conduit/app-client": resolve(
          __dirname,
          "../../packages/app-client/src/index.ts",
        ),
        "@conduit/app-core": resolve(
          __dirname,
          "../../packages/app-core/src/index.ts",
        ),
        "@conduit/design-system-desktop": resolve(
          __dirname,
          "../../packages/design-system-desktop/src/index.ts",
        ),
        "@conduit/design-system-tokens": resolve(
          __dirname,
          "../../packages/design-system-tokens/src/index.ts",
        ),
      },
    },
    plugins: [react()],
  },
});
