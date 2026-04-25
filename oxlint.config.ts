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
      files: ["**/*.config.ts", "**/*.config.mts", "oxlint.config.ts"],
      rules: {
        "eslint/max-lines": "off",
        "import/no-nodejs-modules": "off",
        "import/no-default-export": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
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
        "oxc/no-async-await": "off",
      },
    },
    {
      files: [
        "apps/desktop/src/main/stage/runtime.ts",
        "apps/desktop/src/main/daemon/**/*.ts",
        "src/main/stage/runtime.ts",
        "src/main/daemon/**/*.ts",
        "**/src/main/stage/runtime.ts",
        "**/src/main/daemon/**/*.ts",
        "apps/frontend/src/features/desktop-pairing/**/*.ts",
        "apps/frontend/src/features/desktop-pairing/**/*.tsx",
        "src/features/desktop-pairing/**/*.ts",
        "src/features/desktop-pairing/**/*.tsx",
        "**/src/features/desktop-pairing/**/*.ts",
        "**/src/features/desktop-pairing/**/*.tsx",
      ],
      rules: {
        "eslint/no-await-in-loop": "off",
        "oxc/no-async-await": "off",
      },
    },
    {
      files: ["apps/frontend/src/**/*.ts", "apps/frontend/src/**/*.tsx"],
      rules: {
        "conduit/no-frontend-raw-hex-color": error,
        "conduit/no-frontend-stylesheet": error,
      },
    },
    {
      files: [
        "apps/frontend/src/app-state/**/*.ts",
        "src/app-state/**/*.ts",
        "**/src/app-state/**/*.ts",
      ],
      rules: {
        "oxc/no-async-await": "off",
      },
    },
    {
      files: [
        "apps/frontend/src/app/**/*.tsx",
        "**/src/app/**/*.tsx",
        "src/app/**/*.tsx",
      ],
      rules: {
        "eslint/max-lines": "off",
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
    {
      files: ["scripts/session-boundary.test.ts"],
      rules: {
        "eslint/id-length": "off",
        "import/no-relative-parent-imports": "off",
      },
    },
    {
      files: [
        "**/*.test.ts",
        "apps/desktop/test/**/*.ts",
        "test/**/*.ts",
        "**/test/**/*.ts",
      ],
      rules: {
        "import/no-relative-parent-imports": "off",
      },
    },
    {
      files: [
        "apps/desktop/src/client.ts",
        "apps/desktop/src/server.ts",
        "src/client.ts",
        "src/server.ts",
        "**/src/client.ts",
        "**/src/server.ts",
      ],
      rules: {
        "eslint/no-ternary": "off",
        "eslint/default-case": "off",
        "eslint/id-length": "off",
        "eslint/max-lines": "off",
        "eslint/max-lines-per-function": "off",
        "eslint/max-statements": "off",
        "eslint/no-use-before-define": "off",
        "import/consistent-type-specifier-style": "off",
        "import/no-nodejs-modules": "off",
        "promise/avoid-new": "off",
        "oxc/no-async-await": "off",
        "typescript/consistent-return": "off",
        "typescript/explicit-function-return-type": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-redundant-type-constituents": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/promise-function-async": "off",
        "typescript/strict-boolean-expressions": "off",
        "unicorn/prefer-import-meta-properties": "off",
        "unicorn/prefer-query-selector": "off",
        "unicorn/prefer-top-level-await": "off",
        "unicorn/switch-case-braces": "off",
      },
    },
    {
      files: [
        "packages/app-client/src/index.ts",
        "packages/session-client/src/index.ts",
      ],
      rules: {
        "eslint/id-length": "off",
        "oxc/no-async-await": "off",
      },
    },
    {
      files: [
        "packages/session-client/src/*SessionClient.ts",
        "packages/session-client/src/transport/**/*.ts",
      ],
      rules: {
        "eslint/id-length": "off",
        "oxc/no-async-await": "off",
      },
    },
    {
      files: ["packages/session-contracts/src/index.ts"],
      rules: {
        "eslint/id-length": "off",
      },
    },
    {
      files: ["packages/session-client/src/index.ts"],
      rules: {
        "promise/avoid-new": "off",
      },
    },
    {
      files: ["packages/relay-transport/src/**/*.ts"],
      rules: {
        "eslint/id-length": "off",
        "eslint/max-statements": "off",
        "eslint/no-ternary": "off",
        "eslint/no-use-before-define": "off",
        "eslint/require-await": "off",
        "import/group-exports": "off",
        "oxc/no-async-await": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/no-unsafe-assignment": "off",
        "unicorn/prefer-spread": "off",
        "unicorn/prefer-ternary": "off",
      },
    },
    {
      files: ["packages/relay-transport/src/**/*.test.ts"],
      rules: {
        "eslint/max-lines-per-function": "off",
        "oxc/no-async-await": "off",
        "oxc/no-rest-spread-properties": "off",
      },
    },
    {
      files: ["packages/cloudflare-relay/src/**/*.ts"],
      rules: {
        "eslint/id-length": "off",
        "typescript/promise-function-async": "off",
      },
    },
    {
      files: [
        "packages/cloudflare-relay/src/index.ts",
        "packages/cloudflare-relay/src/testIndex.ts",
      ],
      rules: {
        "import/no-default-export": "off",
        "import/no-anonymous-default-export": "off",
        "eslint/no-use-before-define": "off",
        "eslint/require-await": "off",
        "oxc/no-async-await": "off",
        "typescript/promise-function-async": "off",
      },
    },
    {
      files: ["packages/cloudflare-relay/src/request.ts"],
      rules: {
        "eslint/max-statements": "off",
        "eslint/no-use-before-define": "off",
      },
    },
    {
      files: ["packages/cloudflare-relay/src/relayObject.ts"],
      rules: {
        "eslint/class-methods-use-this": "off",
        "eslint/max-params": "off",
        "eslint/max-statements": "off",
        "eslint/no-use-before-define": "off",
      },
    },
    {
      files: [
        "packages/cloudflare-relay/src/**/*.test.ts",
        "packages/cloudflare-relay/src/relayAdversarialHarness.ts",
        "packages/cloudflare-relay/src/serviceRelayProcess.ts",
        "packages/cloudflare-relay/src/serviceRelayTestUtils.ts",
        "packages/cloudflare-relay/src/relayTestHarness.ts",
      ],
      rules: {
        "eslint/prefer-object-spread": "off",
        "eslint/max-lines-per-function": "off",
        "eslint/no-use-before-define": "off",
        "import/no-nodejs-modules": "off",
        "jest/max-expects": "off",
        "eslint/max-statements": "off",
        "eslint/no-await-in-loop": "off",
        "eslint/no-ternary": "off",
        "unicorn/numeric-separators-style": "off",
        "unicorn/prefer-ternary": "off",
        "vitest/no-conditional-tests": "off",
        "vitest/prefer-strict-boolean-matchers": "off",
        "vitest/prefer-to-be-truthy": "off",
        "oxc/no-async-await": "off",
        "promise/avoid-new": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/promise-function-async": "off",
      },
    },
  ],
});
