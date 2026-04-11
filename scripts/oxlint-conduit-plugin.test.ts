import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..");
const pluginPath = join(import.meta.dirname, "oxlint-conduit-plugin.ts");

interface OxlintResult {
  output: string;
  status: number | null;
}

function runFixture(
  source: string,
  relativePath = "fixture.tsx",
): OxlintResult {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "conduit-oxlint-"));
  const configPath = join(fixtureDirectory, "oxlint.config.ts");
  const fixturePath = join(fixtureDirectory, relativePath);
  mkdirSync(dirname(fixturePath), { recursive: true });

  writeFileSync(
    configPath,
    [
      "export default {",
      `  jsPlugins: [${JSON.stringify(pluginPath)}],`,
      "  rules: {",
      '    "conduit/no-frontend-raw-hex-color": "error",',
      '    "conduit/no-frontend-stylesheet": "error",',
      '    "conduit/no-plain-html-text-elements": "error",',
      "  },",
      "};",
      "",
    ].join("\n"),
  );
  writeFileSync(fixturePath, source);

  const result: SpawnSyncReturns<string> = spawnSync(
    "pnpm",
    ["exec", "oxlint", fixturePath, "--config", configPath, "--deny-warnings"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  return {
    output: `${result.stdout}${result.stderr}`,
    status: result.status,
  };
}

describe("Conduit Oxlint plugin", () => {
  it("rejects direct text in plain HTML elements", () => {
    const result = runFixture("export const View = () => <div>Hello</div>;\n");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("conduit(no-plain-html-text-elements)");
  });

  it("allows text inside component elements", () => {
    const result = runFixture(
      "export const View = () => <Text>Hello</Text>;\n",
    );

    expect(result.status).toBe(0);
    expect(result.output).toContain("Found 0 warnings and 0 errors");
  });

  it("rejects React Native StyleSheet imports", () => {
    const result = runFixture(
      'import { StyleSheet } from "react-native";\nexport const styles = StyleSheet.create({});\n',
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("conduit(no-frontend-stylesheet)");
  });

  it("rejects raw hex colors outside the frontend theme", () => {
    const result = runFixture('export const color = "#ffffff";\n');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("conduit(no-frontend-raw-hex-color)");
  });

  it("allows raw hex colors in the frontend theme contract", () => {
    const result = runFixture(
      'export const colors = { background: "#ffffff" };\n',
      "apps/frontend/src/theme/theme.ts",
    );

    expect(result.status).toBe(0);
    expect(result.output).toContain("Found 0 warnings and 0 errors");
  });
});
