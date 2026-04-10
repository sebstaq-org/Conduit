import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(
  {
    ignores: [
      "artifacts/**/*",
      "vendor/**/*",
      "**/dist/**/*",
      "**/node_modules/**/*",
      "**/target/**/*",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.typecheck.json",
        tsconfigRootDir: repoRoot,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
);
