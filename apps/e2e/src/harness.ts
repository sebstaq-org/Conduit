import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { createRequire } from "node:module";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { deriveRelayConnectionId } from "@conduit/relay-transport";
import type { Server as HttpServer, ServerResponse } from "node:http";

interface E2eHarness {
  readonly frontendUrl: string;
  readonly serviceUrl: string;
  readonly sessionWsUrl: string;
  addProject(cwd: string): Promise<void>;
  closeRelayDataSocket(): Promise<void>;
  pairingUrl(): Promise<string>;
  relaySnapshot(): Promise<RelaySnapshot>;
  stop(): Promise<void>;
}

interface E2eHarnessOptions {
  readonly fixtureRoot?: string | undefined;
}

interface ManagedProcess {
  readonly name: string;
  readonly child: ReturnType<typeof spawn>;
  readonly logs: string[];
}

interface RuntimeCommandResponse {
  readonly ok: boolean;
  readonly error?: { readonly message: string } | null;
  readonly result?: unknown;
}

interface PairingResponse {
  readonly offer: {
    readonly relay: {
      readonly clientCapability: string;
      readonly serverId: string;
    };
  };
  readonly url: string;
}

interface RelaySnapshot {
  readonly clientMessageCount: number;
  readonly clientSocketCount: number;
  readonly controlSocketCount: number;
  readonly dataMessageCount: number;
  readonly dataSocketCount: number;
  readonly totalClientBytes: number;
  readonly totalDataBytes: number;
}

interface MiniflareRuntime {
  readonly ready: Promise<URL>;
  dispose(): Promise<void>;
}

type MiniflareConstructor = new (
  options: Record<string, unknown>,
) => MiniflareRuntime;

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(sourceDir, "..");
const repoRoot = resolve(appRoot, "..", "..");
const relayTestWorkerScript = join(
  repoRoot,
  "packages",
  "cloudflare-relay",
  "src",
  "testIndex.ts",
);
const defaultFixtureRoot = join(appRoot, "fixtures", "provider");
const serviceBin = join(
  cargoTargetDirectory(),
  "debug",
  executableName("service-bin"),
);
const fixtureCwd = "/tmp/conduit-e2e-fixture-project";
const frontendReadyTimeoutMs = 180_000;
const relayAdminToken = "conduit-frontend-e2e-relay-admin";
const require = createRequire(import.meta.url);
const Miniflare = (require("miniflare") as { Miniflare: MiniflareConstructor })
  .Miniflare;

async function startE2eHarness(
  options: E2eHarnessOptions = {},
): Promise<E2eHarness> {
  const runRoot = await mkdtemp(join(tmpdir(), "conduit-e2e-"));
  await mkdir(fixtureCwd, { recursive: true });
  const servicePort = await freePort();
  const frontendPort = await freePort();
  const frontendBuildDir = join(runRoot, "frontend-web");
  const sessionWsUrl = `ws://127.0.0.1:${servicePort}/api/session`;
  const serviceUrl = `http://127.0.0.1:${servicePort}`;
  const frontendUrl = `http://localhost:${frontendPort}`;
  const providerFixtureRoot = options.fixtureRoot ?? defaultFixtureRoot;
  const processes: ManagedProcess[] = [];
  let cachedPairing: PairingResponse | null = null;
  let frontendServer: HttpServer | null = null;
  let relayServer: MiniflareRuntime | null = null;

  async function harnessPairing(): Promise<PairingResponse> {
    if (cachedPairing === null) {
      cachedPairing = await fetchPairing(serviceUrl);
    }
    return cachedPairing;
  }

  async function refreshHarnessPairing(): Promise<PairingResponse> {
    cachedPairing = await fetchPairing(serviceUrl);
    return cachedPairing;
  }

  try {
    const relayEndpoint = await startMiniflareRelay();
    relayServer = relayEndpoint.runtime;
    processes.push(
      spawnManaged("service-bin", serviceBin, [
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        String(servicePort),
        "--provider-fixtures",
        providerFixtureRoot,
        "--store-path",
        join(runRoot, "local-store.sqlite3"),
        "--relay-endpoint",
        relayEndpoint.url,
        "--app-base-url",
        frontendUrl,
      ]),
    );
    await waitForHttp(`${serviceUrl}/health`, processes);
    await sendRuntimeCommand(sessionWsUrl, "settings/update", "all", {
      sessionGroupsUpdatedWithinDays: null,
    });

    await runManaged(
      "expo-export-web",
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
        frontendBuildDir,
        "--clear",
      ],
      {
        CI: "1",
        EXPO_NO_TELEMETRY: "1",
        EXPO_PUBLIC_CONDUIT_SESSION_WS_URL: sessionWsUrl,
      },
    );
    frontendServer = await startStaticServer(frontendBuildDir, frontendPort);
    await waitForHttp(frontendUrl, processes, frontendReadyTimeoutMs);

    return {
      addProject: async (cwd: string) => {
        await sendRuntimeCommand(sessionWsUrl, "projects/add", "all", { cwd });
        await waitForIndexedSessions(sessionWsUrl, cwd, processes, "all");
      },
      closeRelayDataSocket: async () => {
        await closeRelayDataSocket(relayEndpoint.url, await harnessPairing());
      },
      frontendUrl,
      pairingUrl: async () => (await refreshHarnessPairing()).url,
      relaySnapshot: async () =>
        await fetchRelaySnapshot(relayEndpoint.url, await harnessPairing()),
      serviceUrl,
      sessionWsUrl,
      stop: async () => {
        await closeStaticServer(frontendServer);
        await stopProcesses(processes);
        await relayServer?.dispose();
        await rm(runRoot, { force: true, recursive: true });
      },
    };
  } catch (error) {
    await closeStaticServer(frontendServer);
    await stopProcesses(processes);
    await relayServer?.dispose();
    await rm(runRoot, { force: true, recursive: true });
    throw error;
  }
}

async function startMiniflareRelay(): Promise<{
  runtime: MiniflareRuntime;
  url: string;
}> {
  const workerScript = await bundleWorkerScript(relayTestWorkerScript);
  const runtime = new Miniflare({
    bindings: { CONDUIT_RELAY_TEST_ADMIN_TOKEN: relayAdminToken },
    compatibilityDate: "2026-04-18",
    durableObjects: {
      RELAY: "RelayDurableObject",
    },
    host: "127.0.0.1",
    modules: true,
    port: 0,
    script: workerScript,
  });
  const ready = await runtime.ready;
  return { runtime, url: ready.toString().replace(/\/$/u, "") };
}

async function bundleWorkerScript(scriptPath: string): Promise<string> {
  const result = await build({
    bundle: true,
    entryPoints: [scriptPath],
    format: "esm",
    platform: "browser",
    write: false,
  });
  const output = result.outputFiles[0]?.text;
  if (output === undefined) {
    throw new Error("relay worker bundle was not produced");
  }
  return output;
}

async function fetchPairing(serviceUrl: string): Promise<PairingResponse> {
  const response = await fetch(`${serviceUrl}/api/pairing`);
  if (!response.ok) {
    throw new Error(
      `pairing failed ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as PairingResponse;
}

async function closeRelayDataSocket(
  relayEndpoint: string,
  pairing: PairingResponse,
): Promise<void> {
  const url = new URL(`${relayEndpoint}/__conduit_test/close-data`);
  url.searchParams.set("serverId", pairing.offer.relay.serverId);
  url.searchParams.set(
    "connectionId",
    deriveRelayConnectionId(pairing.offer.relay.clientCapability),
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `close relay data failed ${response.status}: ${await response.text()}`,
    );
  }
}

async function fetchRelaySnapshot(
  relayEndpoint: string,
  pairing: PairingResponse,
): Promise<RelaySnapshot> {
  const url = new URL(`${relayEndpoint}/__conduit_test/snapshot`);
  url.searchParams.set("serverId", pairing.offer.relay.serverId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `relay snapshot failed ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as RelaySnapshot;
}

function spawnManaged(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): ManagedProcess {
  const logs: string[] = [];
  const child = spawn(command, args, {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
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

function cargoTargetDirectory(): string {
  const result = spawnSync(
    "cargo",
    [
      "metadata",
      "--manifest-path",
      join(repoRoot, "backend", "service", "Cargo.toml"),
      "--format-version",
      "1",
      "--no-deps",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`cargo metadata failed\n${result.stderr}`);
  }
  const metadata = JSON.parse(result.stdout) as { target_directory?: unknown };
  if (typeof metadata.target_directory !== "string") {
    throw new Error("cargo metadata did not include target_directory");
  }
  return metadata.target_directory;
}

function executableName(name: string): string {
  return process.platform === "win32" ? `${name}.exe` : name;
}

async function runManaged(
  name: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  const process = spawnManaged(name, command, args, env);
  await waitForProcessSuccess(process);
}

function appendLogs(logs: string[], chunk: string): void {
  logs.push(...chunk.split(/\r?\n/u).filter((line) => line.length > 0));
  while (logs.length > 80) {
    logs.shift();
  }
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

async function startStaticServer(
  root: string,
  port: number,
): Promise<HttpServer> {
  const server = createHttpServer((request, response) => {
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

async function closeStaticServer(server: HttpServer | null): Promise<void> {
  if (server === null) {
    return;
  }
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
    const server = createServer();
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

async function waitForHttp(
  url: string,
  processes: ManagedProcess[],
  timeoutMs = 20_000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    assertProcessesRunning(processes);
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }
  throw new Error(`timed out waiting for ${url}\n${processLogs(processes)}`);
}

function assertProcessesRunning(processes: ManagedProcess[]): void {
  const stopped = processes.find((process) => process.child.exitCode !== null);
  if (stopped === undefined) {
    return;
  }
  throw new Error(
    `${stopped.name} exited before readiness\n${processLogs(processes)}`,
  );
}

function processLogs(processes: ManagedProcess[]): string {
  return processes
    .map((process) =>
      [`[${process.name}]`, ...process.logs.slice(-30)].join("\n"),
    )
    .join("\n");
}

async function sendRuntimeCommand(
  wsUrl: string,
  command: string,
  provider: string,
  params: unknown,
): Promise<unknown> {
  const id = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const response = await sendCommandFrame(wsUrl, {
    command,
    id,
    params,
    provider,
  });
  if (!response.ok) {
    throw new Error(response.error?.message ?? `${command} failed`);
  }
  return response.result;
}

async function waitForIndexedSessions(
  wsUrl: string,
  cwd: string,
  processes: ManagedProcess[],
  provider: string,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    assertProcessesRunning(processes);
    const result = await sendRuntimeCommand(
      wsUrl,
      "sessions/grouped",
      provider,
      {
        updatedWithinDays: null,
      },
    );
    if (containsSessionForCwd(result, cwd)) {
      return;
    }
    await delay(250);
  }
  throw new Error(
    `timed out waiting for indexed sessions in ${cwd}\n${processLogs(processes)}`,
  );
}

function containsSessionForCwd(value: unknown, cwd: string): boolean {
  if (!isRecord(value) || !Array.isArray(value.groups)) {
    return false;
  }
  return value.groups.some(
    (group) =>
      isRecord(group) &&
      group.cwd === cwd &&
      Array.isArray(group.sessions) &&
      group.sessions.length > 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sendCommandFrame(
  wsUrl: string,
  command: {
    readonly command: string;
    readonly id: string;
    readonly params: unknown;
    readonly provider: string;
  },
): Promise<RuntimeCommandResponse> {
  return new Promise((resolveResponse, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`timed out waiting for ${command.command}`));
    }, 10_000);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          command,
          id: command.id,
          type: "command",
          v: 1,
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        readonly id?: string;
        readonly response?: RuntimeCommandResponse;
        readonly type?: string;
      };
      if (message.type !== "response" || message.id !== command.id) {
        return;
      }
      clearTimeout(timeout);
      socket.close();
      resolveResponse(message.response ?? { ok: false });
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`websocket command failed: ${command.command}`));
    });
  });
}

async function stopProcesses(processes: ManagedProcess[]): Promise<void> {
  await Promise.all(processes.toReversed().map(stopProcess));
}

async function stopProcess(process: ManagedProcess): Promise<void> {
  if (hasExited(process)) {
    return;
  }
  signalProcess(process, "SIGTERM");
  if (await waitForExit(process, 2_000)) {
    return;
  }
  signalProcess(process, "SIGKILL");
  await waitForExit(process, 2_000);
}

function hasExited(process: ManagedProcess): boolean {
  return process.child.exitCode !== null || process.child.signalCode !== null;
}

function signalProcess(
  process: ManagedProcess,
  signal: "SIGKILL" | "SIGTERM",
): void {
  const pid = process.child.pid;
  if (pid === undefined) {
    return;
  }
  try {
    if (globalThis.process.platform === "win32") {
      process.child.kill(signal);
      return;
    }
    globalThis.process.kill(-pid, signal);
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

function waitForExit(
  process: ManagedProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (hasExited(process)) {
    return Promise.resolve(true);
  }
  return new Promise((resolveExit) => {
    const timeout = setTimeout(() => {
      process.child.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolveExit(true);
    };
    process.child.once("exit", onExit);
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

export {
  fixtureCwd,
  defaultFixtureRoot as fixtureRoot,
  freePort,
  relayAdminToken,
  runManaged,
  serviceBin,
  closeStaticServer,
  startE2eHarness,
  startMiniflareRelay,
  startStaticServer,
};
export type { E2eHarness, MiniflareRuntime, RelaySnapshot };
