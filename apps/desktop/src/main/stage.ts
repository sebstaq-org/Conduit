import { app, BrowserWindow, dialog } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

interface StageRuntimeConfig {
  readonly backendHost: string;
  readonly backendLogPath: string;
  readonly backendPidPath: string;
  readonly backendPort: number;
  readonly dataRoot: string;
  readonly electronPidPath: string;
  readonly frontendLogPath: string;
  readonly releaseDir: string;
  readonly statusPath: string;
  readonly webDir: string;
  readonly webHost: string;
  readonly webPort: number;
}

interface StageServiceStatus {
  readonly healthy: boolean;
  readonly healthMessage: string;
  readonly pid: number | null;
  readonly status: "failed" | "healthy" | "starting" | "stopped";
}

const healthAttempts = 60;
const healthRetryMs = 500;
const backendShutdownTimeoutMs = 3000;
const stageWindows = new Set<BrowserWindow>();

let backendProcess: ChildProcess | null = null;
let staticServer: Server | null = null;
let shuttingDown = false;
let backendLogStream: ReturnType<typeof createWriteStream> | null = null;

function readStageRuntimeConfig(): StageRuntimeConfig | null {
  const releaseDir = process.env.CONDUIT_STAGE_RELEASE_DIR;
  if (releaseDir === undefined || releaseDir.trim().length === 0) {
    return null;
  }
  const pidDir = requiredEnv("CONDUIT_STAGE_PID_DIR");
  const logDir = requiredEnv("CONDUIT_STAGE_LOG_DIR");
  return {
    backendHost: envValue("CONDUIT_STAGE_BACKEND_HOST", "127.0.0.1"),
    backendLogPath: join(logDir, "backend.log"),
    backendPidPath: join(pidDir, "backend.pid"),
    backendPort: envPort("CONDUIT_STAGE_BACKEND_PORT", 4274),
    dataRoot: requiredEnv("CONDUIT_STAGE_DATA_ROOT"),
    electronPidPath: join(pidDir, "electron.pid"),
    frontendLogPath: join(logDir, "frontend.log"),
    releaseDir,
    statusPath: requiredEnv("CONDUIT_STAGE_STATUS_FILE"),
    webDir: join(releaseDir, "web"),
    webHost: envValue("CONDUIT_STAGE_WEB_HOST", "127.0.0.1"),
    webPort: envPort("CONDUIT_STAGE_WEB_PORT", 4310),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for stage runtime.`);
  }
  return value;
}

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0 ? fallback : value;
}

function envPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a TCP port number.`);
  }
  return port;
}

function serviceBinPath(config: StageRuntimeConfig): string {
  const extension = process.platform === "win32" ? ".exe" : "";
  return join(config.releaseDir, "bin", `service-bin${extension}`);
}

function stageUrl(config: StageRuntimeConfig): string {
  return `http://${config.webHost}:${String(config.webPort)}/?v=${String(Date.now())}`;
}

function startBackend(config: StageRuntimeConfig): void {
  backendLogStream = createWriteStream(config.backendLogPath, { flags: "a" });
  const spawnedBackend = spawn(
    serviceBinPath(config),
    [
      "serve",
      "--host",
      config.backendHost,
      "--port",
      String(config.backendPort),
    ],
    {
      env: backendEnvironment(config),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  backendProcess = spawnedBackend;
  spawnedBackend.stdout?.pipe(backendLogStream, { end: false });
  spawnedBackend.stderr?.pipe(backendLogStream, { end: false });
  void writeFile(config.backendPidPath, String(spawnedBackend.pid), "utf8");
  spawnedBackend.once("exit", (code, signal) => {
    backendProcess = null;
    void rm(config.backendPidPath, { force: true });
    if (shuttingDown) {
      return;
    }
    const reason = `backend exited unexpectedly with code=${String(code)} signal=${String(signal)}`;
    void writeRuntimeStatus(config, {
      backend: {
        healthy: false,
        healthMessage: reason,
        pid: null,
        status: "failed",
      },
      web: currentWebStatus("healthy"),
    });
    dialog.showErrorBox("Conduit Stage backend stopped", reason);
    app.quit();
  });
}

function backendEnvironment(config: StageRuntimeConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env.CONDUIT_FRONTEND_LOG_PATH = config.frontendLogPath;
  env.CONDUIT_LOG_PROFILE = "stage";
  env.XDG_DATA_HOME = config.dataRoot;
  return env;
}

function stopBackend(config: StageRuntimeConfig): void {
  const processToStop = backendProcess;
  if (processToStop === null) {
    return;
  }
  processToStop.kill("SIGTERM");
  const timeout = setTimeout(() => {
    if (!processToStop.killed) {
      processToStop.kill("SIGKILL");
    }
  }, backendShutdownTimeoutMs);
  timeout.unref();
  void rm(config.backendPidPath, { force: true });
}

function closeBackendLog(): void {
  backendLogStream?.end();
  backendLogStream = null;
}

async function startStaticServer(config: StageRuntimeConfig): Promise<void> {
  staticServer = createServer((request, response) => {
    void serveStageAsset(config, request, response);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    const server = requiredStaticServer();
    server.once("error", rejectListen);
    server.listen(config.webPort, config.webHost, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function requiredStaticServer(): Server {
  if (staticServer === null) {
    throw new Error("stage static server is not initialized.");
  }
  return staticServer;
}

async function serveStageAsset(
  config: StageRuntimeConfig,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end();
    return;
  }
  const url = new URL(request.url ?? "/", `http://${config.webHost}`);
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204, { "content-length": "0" });
    response.end();
    return;
  }
  const assetPath = await resolveAssetPath(config.webDir, url.pathname);
  if (assetPath === null) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-type": contentType(assetPath),
    expires: "0",
    pragma: "no-cache",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  if (isHtmlAsset(assetPath)) {
    response.end(injectStageEnv(config, await readFile(assetPath, "utf8")));
    return;
  }
  createReadStream(assetPath).pipe(response);
}

function isHtmlAsset(path: string): boolean {
  return extname(path) === ".html";
}

function injectStageEnv(config: StageRuntimeConfig, html: string): string {
  const env = {
    EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL: `http://${config.backendHost}:${String(config.backendPort)}/api/client-log`,
    EXPO_PUBLIC_CONDUIT_LOG_PROFILE: "stage",
    EXPO_PUBLIC_CONDUIT_SESSION_WS_URL: `ws://${config.backendHost}:${String(config.backendPort)}/api/session`,
    NODE_ENV: "production",
  };
  const script = `<script>globalThis.process=globalThis.process||{};globalThis.process.env=${JSON.stringify(env).replaceAll("<", String.raw`\u003c`)};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  return `${script}${html}`;
}

async function resolveAssetPath(
  webDir: string,
  pathname: string,
): Promise<string | null> {
  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = resolve(webDir, `.${decodedPath}`);
  if (!isPathInside(webDir, requestedPath)) {
    return null;
  }
  const candidate = await filePathForRequest(requestedPath);
  if (candidate !== null) {
    return candidate;
  }
  if (extname(requestedPath) !== "") {
    return null;
  }
  const indexPath = join(webDir, "index.html");
  return (await readableFile(indexPath)) ? indexPath : null;
}

async function filePathForRequest(requestedPath: string): Promise<string | null> {
  const requestedStat = await stat(requestedPath).catch(() => null);
  if (requestedStat === null) {
    return null;
  }
  if (requestedStat.isFile()) {
    return requestedPath;
  }
  if (!requestedStat.isDirectory()) {
    return null;
  }
  const indexPath = join(requestedPath, "index.html");
  return (await readableFile(indexPath)) ? indexPath : null;
}

async function readableFile(path: string): Promise<boolean> {
  const fileStat = await stat(path).catch(() => null);
  return fileStat?.isFile() ?? false;
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
  const extension = extname(path);
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
  };
  return contentTypes[extension] ?? "application/octet-stream";
}

async function waitForBackendHealth(config: StageRuntimeConfig): Promise<void> {
  let lastError = "backend health was not checked";
  for (let attempt = 0; attempt < healthAttempts; attempt += 1) {
    if (backendProcess === null) {
      throw new Error("backend exited before health check completed.");
    }
    try {
      const response = await fetch(
        `http://${config.backendHost}:${String(config.backendPort)}/health`,
      );
      if (response.ok) {
        return;
      }
      lastError = `health returned HTTP ${String(response.status)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(healthRetryMs);
  }
  throw new Error(`backend did not become healthy: ${lastError}`);
}

async function waitForWebHealth(config: StageRuntimeConfig): Promise<void> {
  const response = await fetch(`http://${config.webHost}:${String(config.webPort)}/`);
  if (!response.ok) {
    throw new Error(`stage web returned HTTP ${String(response.status)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function createStageWindow(config: StageRuntimeConfig): BrowserWindow {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    height: 900,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 1440,
  });
  stageWindows.add(mainWindow);
  mainWindow.once("closed", () => {
    stageWindows.delete(mainWindow);
  });
  void mainWindow.loadURL(stageUrl(config));
  return mainWindow;
}

function currentBackendStatus(
  status: StageServiceStatus["status"],
): StageServiceStatus {
  let pid = backendProcess?.pid ?? null;
  if (status === "stopped") {
    pid = null;
  }
  return {
    healthy: status === "healthy",
    healthMessage: status === "healthy" ? "healthy" : status,
    pid,
    status,
  };
}

function currentWebStatus(
  status: StageServiceStatus["status"],
): StageServiceStatus {
  let pid: number | null = process.pid;
  if (status === "stopped") {
    pid = null;
  }
  return {
    healthy: status === "healthy",
    healthMessage: status === "healthy" ? "healthy" : status,
    pid,
    status,
  };
}

async function writeRuntimeStatus(
  config: StageRuntimeConfig,
  services: {
    readonly backend: StageServiceStatus;
    readonly web: StageServiceStatus;
  },
): Promise<void> {
  const state = runtimeState(services);
  await writeFile(
    config.statusPath,
    `${JSON.stringify(
      {
        services,
        state,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function runtimeState(services: {
  readonly backend: StageServiceStatus;
  readonly web: StageServiceStatus;
}): "failed" | "healthy" | "starting" | "stopped" {
  if (
    services.backend.status === "healthy" &&
    services.web.status === "healthy"
  ) {
    return "healthy";
  }
  if (services.backend.status === "failed" || services.web.status === "failed") {
    return "failed";
  }
  if (
    services.backend.status === "stopped" &&
    services.web.status === "stopped"
  ) {
    return "stopped";
  }
  return "starting";
}

async function writeElectronPid(config: StageRuntimeConfig): Promise<void> {
  await writeFile(config.electronPidPath, String(process.pid), "utf8");
}

async function prepareStageDirectories(config: StageRuntimeConfig): Promise<void> {
  await mkdir(config.dataRoot, { recursive: true });
  await mkdir(resolve(config.backendLogPath, ".."), { recursive: true });
  await mkdir(resolve(config.backendPidPath, ".."), { recursive: true });
}

async function readBuildLabel(config: StageRuntimeConfig): Promise<string> {
  const buildJsonPath = join(config.releaseDir, "meta", "build.json");
  const raw = await readFile(buildJsonPath, "utf8").catch(() => "");
  if (raw.length === 0) {
    return config.releaseDir;
  }
  const parsed = JSON.parse(raw) as { commit?: string; createdAt?: string };
  const commit = parsed.commit?.slice(0, 12) ?? "unknown";
  return `${commit} ${parsed.createdAt ?? ""}`.trim();
}

async function startStageRuntime(config: StageRuntimeConfig): Promise<void> {
  await prepareStageDirectories(config);
  await writeElectronPid(config);
  await writeRuntimeStatus(config, {
    backend: currentBackendStatus("starting"),
    web: currentWebStatus("starting"),
  });
  await startStaticServer(config);
  startBackend(config);
  await waitForBackendHealth(config);
  await waitForWebHealth(config);
  await writeRuntimeStatus(config, {
    backend: currentBackendStatus("healthy"),
    web: currentWebStatus("healthy"),
  });
  const mainWindow = createStageWindow(config);
  mainWindow.setTitle(`Conduit Stage ${await readBuildLabel(config)}`);
}

function shutdownStageRuntime(config: StageRuntimeConfig): void {
  shuttingDown = true;
  stopBackend(config);
  staticServer?.close();
  staticServer = null;
  closeBackendLog();
  void rm(config.electronPidPath, { force: true });
  void writeRuntimeStatus(config, {
    backend: currentBackendStatus("stopped"),
    web: currentWebStatus("stopped"),
  });
}

function reportStageStartupFailure(
  config: StageRuntimeConfig,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  void writeRuntimeStatus(config, {
    backend: {
      healthy: false,
      healthMessage: message,
      pid: backendProcess?.pid ?? null,
      status: "failed",
    },
    web: currentWebStatus("failed"),
  });
  dialog.showErrorBox("Conduit Stage failed to start", message);
  app.exit(1);
}

function bindStageAppLifecycle(config: StageRuntimeConfig): void {
  app.on("before-quit", () => {
    shutdownStageRuntime(config);
  });
  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createStageWindow(config);
    }
  });
}

function runStageRuntime(config: StageRuntimeConfig): void {
  bindStageAppLifecycle(config);
  void app.whenReady().then(
    async () => {
      try {
        await startStageRuntime(config);
      } catch (error) {
        reportStageStartupFailure(config, error);
      }
    },
    (error: unknown) => {
      reportStageStartupFailure(config, error);
    },
  );
}

function runStageRuntimeIfConfigured(): boolean {
  const config = readStageRuntimeConfig();
  if (config === null) {
    return false;
  }
  runStageRuntime(config);
  return true;
}

export { readStageRuntimeConfig, runStageRuntimeIfConfigured };
export type { StageRuntimeConfig };
