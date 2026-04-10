import { defineConfig } from "oxlint";

const error = "error" as const;

export default defineConfig({
  categories: {
    correctness: error,
    pedantic: error,
    perf: error,
    restriction: error,
    style: error,
    suspicious: error,
  },
  env: {
    browser: true,
    es2024: true,
    node: true,
  },
  globals: {
    React: "readonly",
  },
  ignorePatterns: [
    "artifacts/**/*",
    "vendor/**/*",
    "**/dist/**/*",
    "**/out/**/*",
    "**/.expo/**/*",
    "**/.expo-shared/**/*",
    "**/node_modules/**/*",
    "**/target/**/*",
  ],
  jsPlugins: ["./scripts/oxlint-conduit-plugin.ts"],
  options: {
    maxWarnings: 0,
    typeAware: true,
  },
  plugins: [
    "typescript",
    "react",
    "import",
    "jsx-a11y",
    "vitest",
    "promise",
    "unicorn",
    "oxc",
  ],
  rules: {
    "conduit/no-plain-html-text-elements": error,
    "eslint/no-restricted-imports": [
      error,
      {
        paths: [
          {
            importNames: ["useEffect", "useInsertionEffect", "useLayoutEffect"],
            message:
              "Repo-authored frontend code must not use React effect hooks.",
            name: "react",
          },
        ],
      },
    ],
    "eslint/func-style": "off",
    "eslint/no-magic-numbers": "off",
    "eslint/no-void": [error, { allowAsStatement: true }],
    "eslint/no-undefined": "off",
    "eslint/no-duplicate-imports": [error, { allowSeparateTypeImports: true }],
    "eslint/prefer-destructuring": "off",
    "eslint/sort-imports": "off",
    "eslint/sort-keys": "off",
    "jest/require-hook": "off",
    "import/no-named-export": "off",
    "import/prefer-default-export": "off",
    "oxc/no-optional-chaining": "off",
    "react/jsx-filename-extension": [error, { extensions: [".tsx"] }],
    "react/react-in-jsx-scope": "off",
    "unicorn/filename-case": "off",
    "unicorn/no-null": "off",
    "unicorn/require-module-specifiers": "off",
    "vitest/no-importing-vitest-globals": "off",
    "vitest/require-test-timeout": "off",
    "eslint/no-unused-vars": [
      error,
      { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
    ],
    "typescript/consistent-type-imports": [error, { prefer: "type-imports" }],
    "typescript/no-floating-promises": error,
    "typescript/no-misused-promises": error,
  },
  settings: {
    react: {
      version: "19.2.0",
    },
  },
  overrides: [
    {
      files: ["**/*.config.ts", "oxlint.config.ts"],
      rules: {
        "import/no-nodejs-modules": "off",
        "import/no-default-export": "off",
      },
    },
    {
      files: [
        "apps/desktop/src/main/**/*.ts",
        "apps/desktop/src/preload/**/*.ts",
        "**/src/main/**/*.ts",
        "**/src/preload/**/*.ts",
        "src/main/**/*.ts",
        "src/preload/**/*.ts",
      ],
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
    {
      files: [
        "apps/mobile/src/app/**/*.tsx",
        "**/src/app/**/*.tsx",
        "src/app/**/*.tsx",
      ],
      rules: {
        "import/no-default-export": "off",
      },
    },
    {
      files: ["scripts/oxlint-conduit-plugin.ts"],
      rules: {
        "import/no-default-export": "off",
      },
    },
    {
      files: ["scripts/**/*.test.ts"],
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
  ],
});
