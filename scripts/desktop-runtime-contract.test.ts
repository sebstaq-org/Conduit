import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const repoRoot = process.cwd();
const forbiddenRuntimeFragments = [
  "CONDUIT_STAGE_RUNTIME",
  "CONDUIT_DESKTOP_DAEMON",
  "StageBackend",
  "StageRuntime",
  "disabledStatus",
  "desktop daemon is not configured",
  "ELECTRON_RENDERER_URL",
  "readStageRuntimeConfig",
  "runStageRuntimeIfConfigured",
] as const;
const scanRoots = [
  "apps/desktop/src",
  "apps/e2e/src",
  "apps/e2e/tests",
  "scripts/stage",
  "README.md",
] as const;
const sandboxRuntimeFiles = [
  "apps/desktop/package.json",
  "apps/desktop/src/main/index.ts",
  "apps/e2e/src/desktopHarness.ts",
  "apps/e2e/tests/desktop-managed-daemon.spec.ts",
  "apps/e2e/tests/desktop-sandboxed-preload.spec.ts",
  "scripts/stage/conduit-stage.sh",
] as const;

function sourceFiles(path: string): string[] {
  let absolutePath = path;
  if (!isAbsolute(path)) {
    absolutePath = join(repoRoot, path);
  }
  const stat = statSync(absolutePath);
  if (stat.isFile()) {
    return [absolutePath];
  }
  return readdirSync(absolutePath).flatMap((entry) => {
    const childPath = join(absolutePath, entry);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) {
      return sourceFiles(childPath);
    }
    if (/\.(md|sh|ts|tsx)$/u.test(entry)) {
      return [childPath];
    }
    return [];
  });
}

describe("desktop runtime contract", () => {
  it("keeps one managed desktop runtime and no fallback runtime paths", () => {
    // Per user contract: dev, stage, and E2E must use the same desktop runtime.
    const violations = scanRoots.flatMap((root) =>
      sourceFiles(root).flatMap((file) => {
        if (file.endsWith("desktop-runtime-contract.test.ts")) {
          return [];
        }
        const text = readFileSync(file, "utf8");
        return forbiddenRuntimeFragments
          .filter((fragment) => text.includes(fragment))
          .map((fragment) => `${file}: ${fragment}`);
      }),
    );

    expect(violations).toStrictEqual([]);
  });

  it("keeps desktop dev, stage, and E2E on Chromium sandbox", () => {
    // Per user contract: desktop runtime must not launch Electron with --no-sandbox.
    const violations = sandboxRuntimeFiles.flatMap((file) => {
      const text = readFileSync(join(repoRoot, file), "utf8");
      return ["--no-sandbox", "--noSandbox"]
        .filter((fragment) => text.includes(fragment))
        .map((fragment) => `${file}: ${fragment}`);
    });

    expect(violations).toStrictEqual([]);
  });
});
