import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import { URL, fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(
  {
    ignores: [".expo/**/*", ".expo-shared/**/*", "node_modules/**/*"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: appRoot,
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: [
                "useEffect",
                "useInsertionEffect",
                "useLayoutEffect",
              ],
              message:
                "Repo-authored frontend code must not use React effect hooks.",
            },
          ],
        },
      ],
    },
  },
);
