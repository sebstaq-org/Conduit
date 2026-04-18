import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
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
import type { Server as HttpServer, ServerResponse } from "node:http";

interface E2eHarness {
  readonly frontendUrl: string;
  readonly serviceUrl: string;
  readonly sessionWsUrl: string;
  addProject(cwd: string): Promise<void>;
  stop(): Promise<void>;
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

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(sourceDir, "..");
const repoRoot = resolve(appRoot, "..", "..");
const fixtureRoot = join(appRoot, "fixtures", "provider");
const serviceBin = join(
  repoRoot,
  "backend",
  "service",
  "target",
  "debug",
  "service-bin",
);
const fixtureCwd = "/tmp/conduit-e2e-fixture-project";
const frontendReadyTimeoutMs = 180_000;

async function startE2eHarness(): Promise<E2eHarness> {
  const runRoot = await mkdtemp(join(tmpdir(), "conduit-e2e-"));
  await mkdir(fixtureCwd, { recursive: true });
  const servicePort = await freePort();
  const frontendPort = await freePort();
  const frontendBuildDir = join(runRoot, "frontend-web");
  const sessionWsUrl = `ws://127.0.0.1:${servicePort}/api/session`;
  const serviceUrl = `http://127.0.0.1:${servicePort}`;
  const frontendUrl = `http://localhost:${frontendPort}`;
  const processes: ManagedProcess[] = [];
  let frontendServer: HttpServer | null = null;

  try {
    processes.push(
      spawnManaged("service-bin", serviceBin, [
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        String(servicePort),
        "--provider-fixtures",
        fixtureRoot,
        "--store-path",
        join(runRoot, "local-store.sqlite3"),
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
      frontendUrl,
      serviceUrl,
      sessionWsUrl,
      stop: async () => {
        await closeStaticServer(frontendServer);
        await stopProcesses(processes);
        await rm(runRoot, { force: true, recursive: true });
      },
    };
  } catch (error) {
    await closeStaticServer(frontendServer);
    await stopProcesses(processes);
    await rm(runRoot, { force: true, recursive: true });
    throw error;
  }
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

export { fixtureCwd, startE2eHarness };
export type { E2eHarness };
