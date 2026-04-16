import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

interface PhraseGuard {
  label: string;
  pattern: RegExp;
}

interface LocalMarkdownLink {
  rawPath: string;
  target: string;
}

const DISALLOWED_PHRASES: readonly PhraseGuard[] = [
  { label: "current pass", pattern: /\bcurrent pass\b/i },
  { label: "this pass", pattern: /\bthis pass\b/i },
  { label: "temporary panel preview", pattern: /\btemporary panel preview\b/i },
  { label: "in this checkout", pattern: /\bin this checkout\b/i },
];

function listMarkdownFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "*.md"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .filter((path) => existsSync(resolve(REPO_ROOT, path)));
}

function readText(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function insertionIndex(sorted: readonly string[], value: string): number {
  let index = 0;
  while (index < sorted.length && sorted[index]?.localeCompare(value) === -1) {
    index += 1;
  }
  return index;
}

function sortedUnique(values: Iterable<string>): string[] {
  const unique: string[] = [];
  for (const value of values) {
    if (!unique.includes(value)) {
      unique.push(value);
    }
  }

  const sorted: string[] = [];
  for (const value of unique) {
    const index = insertionIndex(sorted, value);
    sorted.splice(index, 0, value);
  }

  return sorted;
}

function findLineNumber(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function parseDefaultServePort(serveCliSource: string): number {
  const match = /"--port"\)\?\.unwrap_or\((\d+)\)/.exec(serveCliSource);
  if (match?.[1] === undefined) {
    throw new Error(
      "Could not parse default --port from service-bin cli source",
    );
  }
  return Number(match[1]);
}

function parseSessionRoute(serveSource: string): string {
  const match = /route\("([^"]+)",\s*get\(session_socket\)\)/.exec(serveSource);
  if (match?.[1] === undefined) {
    throw new Error("Could not parse /api/session route from serve source");
  }
  return match[1];
}

function parseHookNames(source: string): string[] {
  const matches = source.match(/\buse[A-Za-z0-9]+(?:Query|Mutation)\b/g) ?? [];
  return sortedUnique(matches);
}

function parseEnvVars(source: string): string[] {
  return sortedUnique(
    Array.from(
      source.matchAll(/process\.env\.([A-Z0-9_]+)/g),
      (match) => match[1] ?? "",
    ),
  );
}

function findMarkdownLinks(source: string): string[] {
  return Array.from(
    source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g),
    (match) => match[1] ?? "",
  );
}

function isExternalOrSpecialTarget(target: string): boolean {
  const lower = target.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("capture://") ||
    lower.startsWith("ws://") ||
    lower.startsWith("wss://") ||
    lower.startsWith("#")
  );
}

function parseLocalMarkdownLink(target: string): LocalMarkdownLink | null {
  const trimmed = target.trim();
  if (trimmed.length === 0 || isExternalOrSpecialTarget(trimmed)) {
    return null;
  }
  const rawPath = trimmed.split("#", 1)[0] ?? "";
  if (rawPath.length === 0) {
    return null;
  }
  return { rawPath, target: trimmed };
}

function resolveMarkdownPath(markdownPath: string, rawPath: string): string {
  if (rawPath.startsWith("/")) {
    return resolve(REPO_ROOT, `.${rawPath}`);
  }
  return resolve(REPO_ROOT, dirname(markdownPath), rawPath);
}

function markdownLinkViolation(
  markdownPath: string,
  localLink: LocalMarkdownLink,
): string | null {
  const resolved = resolveMarkdownPath(markdownPath, localLink.rawPath);
  const exists = existsSync(resolved);
  if (exists) {
    const stats = statSync(resolved);
    const isValidTarget = stats.isFile() || stats.isDirectory();
    if (isValidTarget) {
      return null;
    }
    return `${markdownPath} -> ${localLink.target} (not file/dir)`;
  }
  return `${markdownPath} -> ${localLink.target} (missing path)`;
}

function validateMarkdownLinks(markdownPath: string, source: string): string[] {
  const violations: string[] = [];

  for (const link of findMarkdownLinks(source)) {
    const localLink = parseLocalMarkdownLink(link);
    if (localLink !== null) {
      const violation = markdownLinkViolation(markdownPath, localLink);
      if (violation !== null) {
        violations.push(violation);
      }
    }
  }

  return violations;
}

function stalePhraseViolations(markdownPath: string, source: string): string[] {
  const violations: string[] = [];

  for (const guard of DISALLOWED_PHRASES) {
    const match = guard.pattern.exec(source);
    if (match?.index !== undefined) {
      violations.push(
        `${markdownPath}:${String(findLineNumber(source, match.index))} uses disallowed phrase "${guard.label}"`,
      );
    }
  }

  return violations;
}

function readExpectedTransportUrl(): string {
  const cliSource = readText("backend/service/crates/service-bin/src/cli.rs");
  const serveSource = readText(
    "backend/service/crates/service-bin/src/serve/mod.rs",
  );
  const defaultPort = parseDefaultServePort(cliSource);
  const sessionRoute = parseSessionRoute(serveSource);
  return `ws://127.0.0.1:${String(defaultPort)}${sessionRoute}`;
}

describe("docs guardrails", () => {
  test("markdown files do not contain stale time-bound phrases", () => {
    const violations = listMarkdownFiles().flatMap((path) =>
      stalePhraseViolations(path, readText(path)),
    );

    expect(violations).toStrictEqual([]);
  });

  test("service transport URL in docs matches Rust runtime defaults", () => {
    const expectedUrl = readExpectedTransportUrl();

    expect(readText("README.md")).toContain(expectedUrl);
    expect(readText("backend/service/README.md")).toContain(expectedUrl);
  });

  test("app-state README hook list matches exported product hooks", () => {
    const exportedHooks = parseHookNames(
      readText("apps/frontend/src/app-state/index.ts"),
    );
    const documentedHooks = parseHookNames(
      readText("apps/frontend/src/app-state/README.md"),
    );

    expect(documentedHooks).toStrictEqual(exportedHooks);
  });

  test("app-state README env var matches frontend session transport source", () => {
    const sessionClientSource = readText(
      "apps/frontend/src/app-state/session-client.ts",
    );
    const envVars = parseEnvVars(sessionClientSource);

    expect(envVars).toStrictEqual(["EXPO_PUBLIC_CONDUIT_SESSION_WS_URL"]);
    expect(readText("apps/frontend/src/app-state/README.md")).toContain(
      envVars[0],
    );
  });

  test("markdown relative links resolve to existing paths", () => {
    const violations = listMarkdownFiles().flatMap((path) =>
      validateMarkdownLinks(path, readText(path)),
    );

    expect(violations).toStrictEqual([]);
  });
});
