import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createTcpServer } from "node:net";
import { chromium } from "@playwright/test";
import type { Browser, BrowserContext } from "@playwright/test";
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
} from "node:child_process";
import type { Server, ServerResponse } from "node:http";

interface ManagedProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly logs: string[];
  readonly name: string;
}

type RuntimeProof = {
  readonly platform: "electron" | "native";
  readonly surface: "desktop_app" | "mobile_app";
};

const sourceDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(sourceDir, "..", "..", "..");
const sentryApiBaseUrl = "https://sentry.io";
const sentryEnvironment = "dev";
const sentryOrg = process.env.SENTRY_ORG ?? "sebstaq";
const sentryProject = process.env.SENTRY_PROJECT_ID ?? "-1";
const queryTimeoutMs = 120_000;
const queryIntervalMs = 5_000;
const startupDelayMs = 5_000;
const runtimeProofs: readonly RuntimeProof[] = [
  { platform: "electron", surface: "desktop_app" },
  { platform: "native", surface: "mobile_app" },
];

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for live Sentry runtime proof.`);
  }
  return value;
}

function generatedRelease(): string {
  return `conduit-sentry-runtime-live-${Date.now().toString(36)}`;
}

function spawnManaged(
  name: string,
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {},
): ManagedProcess {
  const logs: string[] = [];
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    ...options,
    stdio: "pipe",
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => appendLogs(logs, chunk));
  child.stderr.on("data", (chunk) => appendLogs(logs, chunk));
  child.on("exit", (code, signal) => {
    appendLogs(
      logs,
      `${name} exited code=${code ?? "null"} signal=${signal ?? "null"}`,
    );
  });
  return { child, logs, name };
}

function appendLogs(logs: string[], chunk: string): void {
  logs.push(...chunk.split(/\r?\n/u).filter((line) => line.length > 0));
  while (logs.length > 80) {
    logs.shift();
  }
}

function processLogs(processes: readonly ManagedProcess[]): string {
  return processes
    .map((process) =>
      [`[${process.name}]`, ...process.logs.slice(-30)].join("\n"),
    )
    .join("\n");
}

async function waitForProcessSuccess(process: ManagedProcess): Promise<void> {
  if (process.child.exitCode !== null) {
    if (process.child.exitCode === 0) {
      return;
    }
    throw new Error(`${process.name} failed\n${processLogs([process])}`);
  }
  await new Promise<void>((resolvePromise, reject) => {
    process.child.once("error", reject);
    process.child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${process.name} failed\n${processLogs([process])}`));
    });
  });
}

async function runExpoExport(
  outputDir: string,
  dsn: string,
  release: string,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const exportProcess = spawnManaged(
    "expo-export-web-sentry-live",
    "pnpm",
    [
      "--filter",
      "@conduit/frontend",
      "exec",
      "expo",
      "export",
      "--platform",
      "web",
      "--output-dir",
      outputDir,
      "--clear",
    ],
    {
      env: {
        ...process.env,
        APP_VARIANT: "dev",
        CI: "1",
        EXPO_NO_TELEMETRY: "1",
        EXPO_PUBLIC_CONDUIT_LOG_PROFILE: sentryEnvironment,
        EXPO_PUBLIC_CONDUIT_RELEASE: release,
        EXPO_PUBLIC_SENTRY_DSN: dsn,
      },
    },
  );
  await waitForProcessSuccess(exportProcess);
}

async function startStaticServer(root: string, port: number): Promise<Server> {
  const server = createServer((request, response) => {
    void serveStaticAsset(root, request.url ?? "/", response);
  });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
  return server;
}

async function closeStaticServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    server.close(() => {
      resolvePromise();
    });
    server.closeAllConnections();
  });
}

async function serveStaticAsset(
  root: string,
  rawUrl: string,
  response: ServerResponse,
): Promise<void> {
  const requestUrl = new URL(rawUrl, "http://localhost");
  const assetPath = await resolveStaticAsset(root, requestUrl.pathname);
  if (assetPath === null) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": contentType(assetPath),
  });
  createReadStream(assetPath).pipe(response);
}

async function resolveStaticAsset(
  root: string,
  pathname: string,
): Promise<string | null> {
  const requestedPath = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (!isPathInside(root, requestedPath)) {
    return null;
  }
  const filePath = await readableFilePath(requestedPath);
  if (filePath !== null) {
    return filePath;
  }
  if (extname(requestedPath) === "") {
    return await readableFilePath(join(root, "index.html"));
  }
  return null;
}

async function readableFilePath(path: string): Promise<string | null> {
  try {
    const fileStat = await stat(path);
    if (fileStat.isFile()) {
      return path;
    }
    if (fileStat.isDirectory()) {
      return await readableFilePath(join(path, "index.html"));
    }
    return null;
  } catch {
    return null;
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath))
  );
}

function contentType(path: string): string {
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".wasm": "application/wasm",
  };
  return contentTypes[extname(path)] ?? "application/octet-stream";
}

async function freePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createTcpServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address !== null && typeof address === "object") {
          resolvePort(address.port);
          return;
        }
        reject(new Error("failed to allocate local port"));
      });
    });
    server.on("error", reject);
  });
}

async function openDesktopRuntime(
  browser: Browser,
  frontendUrl: string,
): Promise<void> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const conduitGlobal = globalThis as typeof globalThis & {
      CONDUIT_RUNTIME_CONFIG?: { readonly runtimeSurface: string };
    };
    conduitGlobal.CONDUIT_RUNTIME_CONFIG = {
      runtimeSurface: "desktop_app",
    };
  });
  await openFrontend(context, frontendUrl);
  await context.close();
}

async function openMobileRuntime(
  browser: Browser,
  frontendUrl: string,
): Promise<void> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, "product", {
      configurable: true,
      value: "ReactNative",
    });
  });
  await openFrontend(context, frontendUrl);
  await context.close();
}

async function openFrontend(
  context: BrowserContext,
  frontendUrl: string,
): Promise<void> {
  const page = await context.newPage();
  await page.goto(frontendUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(startupDelayMs);
}

function chromiumExecutablePath(): string | undefined {
  return process.env.CONDUIT_CHROMIUM_BIN ?? undefined;
}

async function openRuntimeProofPages(frontendUrl: string): Promise<void> {
  const executablePath = chromiumExecutablePath();
  const browser = await chromium.launch({
    ...(executablePath === undefined ? {} : { executablePath }),
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  try {
    await openDesktopRuntime(browser, frontendUrl);
    await openMobileRuntime(browser, frontendUrl);
  } finally {
    await browser.close();
  }
}

function sentryQuery(release: string, proof: RuntimeProof): string {
  return [
    `release:"${release}"`,
    "event_name:frontend.logging.initialized",
    `runtime_surface:${proof.surface}`,
    `runtime_platform:${proof.platform}`,
  ].join(" ");
}

async function querySentryRuntimeLog(
  token: string,
  release: string,
  proof: RuntimeProof,
): Promise<boolean> {
  const url = new URL(
    `/api/0/organizations/${sentryOrg}/events/`,
    sentryApiBaseUrl,
  );
  url.searchParams.set("dataset", "logs");
  url.searchParams.set("environment", sentryEnvironment);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("project", sentryProject);
  url.searchParams.set("query", sentryQuery(release, proof));
  url.searchParams.set("sort", "-timestamp");
  url.searchParams.append("field", "message");
  url.searchParams.append("field", "timestamp");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Sentry logs query failed with HTTP ${response.status}. SENTRY_AUTH_TOKEN must allow org:read. Response: ${body}`,
    );
  }
  const parsed = JSON.parse(body) as { readonly data?: readonly unknown[] };
  return Array.isArray(parsed.data) && parsed.data.length > 0;
}

async function waitForSentryRuntimeLogs(
  token: string,
  release: string,
): Promise<void> {
  const pending = new Map(
    runtimeProofs.map((proof) => [`${proof.surface}/${proof.platform}`, proof]),
  );
  const startedAt = Date.now();
  while (Date.now() - startedAt < queryTimeoutMs) {
    for (const [key, proof] of pending) {
      if (await querySentryRuntimeLog(token, release, proof)) {
        pending.delete(key);
      }
    }
    if (pending.size === 0) {
      return;
    }
    await delay(queryIntervalMs);
  }
  throw new Error(
    `Timed out waiting for Sentry runtime logs: ${[...pending.keys()].join(", ")}`,
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function main(): Promise<void> {
  const dsn = requiredEnv("EXPO_PUBLIC_SENTRY_DSN");
  const token = requiredEnv("SENTRY_AUTH_TOKEN");
  const release = generatedRelease();
  const runRoot = await mkdtemp(join(tmpdir(), "conduit-sentry-runtime-live-"));
  const frontendBuildDir = join(runRoot, "frontend-web");
  const frontendPort = await freePort();
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  let server: Server | null = null;

  try {
    await runExpoExport(frontendBuildDir, dsn, release);
    server = await startStaticServer(frontendBuildDir, frontendPort);
    await openRuntimeProofPages(frontendUrl);
    await waitForSentryRuntimeLogs(token, release);
    console.log(`sentry-runtime-live: verified ${release}`);
  } finally {
    if (server !== null) {
      await closeStaticServer(server);
    }
    await rm(runRoot, { force: true, recursive: true });
  }
}

await main();
