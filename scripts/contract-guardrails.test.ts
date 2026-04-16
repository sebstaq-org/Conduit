import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const APP_PROTOCOL_GENERATED = resolve(
  REPO_ROOT,
  "packages/app-protocol/src/generated.ts",
);
const APP_PROTOCOL_INDEX = resolve(
  REPO_ROOT,
  "packages/app-protocol/src/index.ts",
);
const APP_PROTOCOL_PACKAGE = resolve(
  REPO_ROOT,
  "packages/app-protocol/package.json",
);
const ROOT_PACKAGE = resolve(REPO_ROOT, "package.json");
const CONTRACT_BUNDLE = resolve(
  REPO_ROOT,
  "packages/app-protocol/generated/consumer-contracts.schema.json",
);
const LEGACY_SESSION_MODEL = resolve(REPO_ROOT, "packages/session-model");
const LEGACY_SESSION_CONTRACTS = resolve(
  REPO_ROOT,
  "packages/session-contracts",
);
const REMOVED_MANUAL_PROTOCOL_FILES = [
  resolve(REPO_ROOT, "packages/app-protocol/src/createConsumerCommand.ts"),
  resolve(REPO_ROOT, "packages/app-protocol/src/wire.ts"),
  resolve(REPO_ROOT, "packages/app-protocol/src/commandParams.ts"),
  resolve(REPO_ROOT, "packages/app-protocol/src/projectCommandFactories.ts"),
];

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

describe("contract guardrails", () => {
  test("app-protocol generated source exists and stays generated", () => {
    expect(readText(APP_PROTOCOL_GENERATED)).toContain(
      "// GENERATED FILE. DO NOT EDIT.",
    );
  });

  test("app-protocol index only re-exports generated contracts", () => {
    expect(readText(APP_PROTOCOL_INDEX).trim()).toBe(
      'export * from "./generated.js";',
    );
  });

  test("app-protocol package does not depend on zod", () => {
    const packageJson = JSON.parse(readText(APP_PROTOCOL_PACKAGE)) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies ?? {}).not.toHaveProperty("zod");
  });

  test("repo scripts enforce app-protocol generation and checking", () => {
    const packageJson = JSON.parse(readText(ROOT_PACKAGE)) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(scripts["contracts:generate"]).toContain("export-contracts");
    expect(scripts["contracts:generate"]).toContain(
      "scripts/generate-app-protocol.ts",
    );
    expect(scripts["contracts:check"]).toContain(
      "packages/app-protocol/src/generated.ts",
    );
    expect(scripts["docs:check"]).toContain(
      "scripts/contract-guardrails.test.ts",
    );
  });

  test("legacy protocol packages are removed", () => {
    expect(existsSync(LEGACY_SESSION_MODEL)).toBeFalsy();
    expect(existsSync(LEGACY_SESSION_CONTRACTS)).toBeFalsy();
  });

  test("manual protocol helper files are removed from app-protocol", () => {
    for (const path of REMOVED_MANUAL_PROTOCOL_FILES) {
      expect(existsSync(path)).toBeFalsy();
    }
  });

  test("generated contract bundle includes the full wire surface", () => {
    const bundle = JSON.parse(readText(CONTRACT_BUNDLE)) as {
      roots?: Record<string, unknown>;
    };
    const roots = bundle.roots ?? {};

    expect(roots).toHaveProperty("ConsumerCommand");
    expect(roots).toHaveProperty("ConsumerCommandName");
    expect(roots).toHaveProperty("ConsumerResponse");
    expect(roots).toHaveProperty("ClientCommandFrame");
    expect(roots).toHaveProperty("ServerFrame");
    expect(roots).toHaveProperty("RuntimeEvent");
  });

  test("generated transcript content stays backed by ACP ContentBlock", () => {
    const generated = readText(APP_PROTOCOL_GENERATED);
    const bundle = JSON.parse(readText(CONTRACT_BUNDLE)) as {
      roots?: Record<string, unknown>;
    };

    expect(generated).toContain("content: ContentBlock[];");
    expect(generated).not.toContain("content: unknown[];");
    expect(generated).toContain("text: string;");
    expect(JSON.stringify(bundle.roots?.TranscriptItem)).toContain(
      "#/$defs/ContentBlock",
    );
  });
});
