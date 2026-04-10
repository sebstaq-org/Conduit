import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..");
const pluginPath = join(import.meta.dirname, "oxlint-conduit-plugin.ts");

interface OxlintResult {
  output: string;
  status: number | null;
}

function runFixture(source: string): OxlintResult {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "conduit-oxlint-"));
  const configPath = join(fixtureDirectory, "oxlint.config.ts");
  const fixturePath = join(fixtureDirectory, "fixture.tsx");

  writeFileSync(
    configPath,
    [
      "export default {",
      `  jsPlugins: [${JSON.stringify(pluginPath)}],`,
      "  rules: {",
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
});
