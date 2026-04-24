import { chromium } from "@playwright/test";
import { createSessionClient } from "@conduit/session-client";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeStaticServer,
  fixtureCwd,
  fixtureRoot,
  freePort,
  relayAdminToken,
  runManaged,
  serviceBin,
  startMiniflareRelay,
  startStaticServer,
} from "./harness.js";
import type { Browser, Page } from "@playwright/test";
import type { ChildProcess } from "node:child_process";
import type { Server as HttpServer } from "node:http";
import type { MiniflareRuntime, RelaySnapshot } from "./harness.js";

interface DesktopE2eHarness {
  readonly page: Page;
  addProject(cwd: string): Promise<void>;
  relaySnapshot(serverId: string): Promise<RelaySnapshot>;
  stop(): Promise<void>;
}

interface DesktopRun {
  readonly browser: Browser;
  readonly electron: ChildProcess;
  readonly logs: string[];
}

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(sourceDir, "..");
const repoRoot = resolve(appRoot, "..", "..");
const desktopPackagePath = join(repoRoot, "apps", "desktop", "package.json");
const desktopRequire = createRequire(desktopPackagePath);
const desktopAppPath = join(repoRoot, "apps", "desktop");

async function startDesktopE2eHarness(): Promise<DesktopE2eHarness> {
  const runRoot = await mkdtemp(join(tmpdir(), "conduit-desktop-e2e-"));
  const frontendBuildDir = join(runRoot, "frontend-web");
  const relay = await startMiniflareRelay();
  let desktopRun: DesktopRun | null = null;
  let frontendServer: HttpServer | null = null;

  try {
    await mkdir(fixtureCwd, { recursive: true });
    await exportFrontendWeb(frontendBuildDir);
    const webPort = await freePort();
    frontendServer = await startStaticServer(frontendBuildDir, webPort);
    const backendPort = await freePort();
    const debugPort = await freePort();
    const sessionWsUrl = `ws://127.0.0.1:${String(backendPort)}/api/session`;
    desktopRun = await startDesktopRun({
      debugPort,
      env: {
        ...process.env,
        CI: "1",
        CONDUIT_DESKTOP_APP_BASE_URL: "conduit://pair",
        CONDUIT_DESKTOP_BACKEND_HOST: "127.0.0.1",
        CONDUIT_DESKTOP_BACKEND_LOG_PATH: join(runRoot, "logs", "backend.log"),
        CONDUIT_DESKTOP_BACKEND_PORT: String(backendPort),
        CONDUIT_DESKTOP_DAEMON: "1",
        CONDUIT_DESKTOP_HOME: join(runRoot, "home"),
        CONDUIT_DESKTOP_PROVIDER_FIXTURES: fixtureRoot,
        CONDUIT_DESKTOP_RELAY_ENDPOINT: relay.url,
        CONDUIT_DESKTOP_SERVICE_BIN: serviceBin,
        CONDUIT_DESKTOP_STORE_PATH: join(runRoot, "local-store.sqlite3"),
        CONDUIT_FRONTEND_URL: `http://127.0.0.1:${String(webPort)}`,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
    });
    const page = await waitForDesktopWindow(desktopRun, runRoot);
    await page.waitForLoadState("domcontentloaded");
    return {
      addProject: async (cwd: string) => {
        await addProjectAndWaitForSessions(sessionWsUrl, cwd);
      },
      page,
      relaySnapshot: async (serverId: string) =>
        await fetchRelaySnapshot(relay.url, serverId),
      stop: async () => {
        await stopDesktop(desktopRun);
        await closeStaticServer(frontendServer);
        await relay.runtime.dispose();
        await rm(runRoot, { force: true, recursive: true });
      },
    };
  } catch (error) {
    const diagnostics = await readDiagnostics(runRoot, desktopRun?.logs ?? []);
    await stopDesktop(desktopRun);
    await closeStaticServer(frontendServer);
    await relay.runtime.dispose();
    await rm(runRoot, { force: true, recursive: true });
    throw new Error(`${errorMessage(error)}\n\n${diagnostics}`);
  }
}

async function exportFrontendWeb(outputDir: string): Promise<void> {
  await runManaged(
    "desktop-e2e-expo-export-web",
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
      CI: "1",
      EXPO_NO_TELEMETRY: "1",
    },
  );
}

async function startDesktopRun(request: {
  readonly debugPort: number;
  readonly env: NodeJS.ProcessEnv;
}): Promise<DesktopRun> {
  const logs: string[] = [];
  const electronProcess = spawn(
    String(desktopRequire("electron")),
    [
      desktopAppPath,
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${String(request.debugPort)}`,
    ],
    {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env: request.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  electronProcess.stdout?.setEncoding("utf8");
  electronProcess.stderr?.setEncoding("utf8");
  electronProcess.stdout?.on("data", (chunk) => appendLogs(logs, chunk));
  electronProcess.stderr?.on("data", (chunk) => appendLogs(logs, chunk));
  const cdpEndpoint = await waitForCdpEndpoint(
    request.debugPort,
    electronProcess,
    logs,
  );
  return {
    browser: await chromium.connectOverCDP(cdpEndpoint),
    electron: electronProcess,
    logs,
  };
}

async function addProjectAndWaitForSessions(
  sessionWsUrl: string,
  cwd: string,
): Promise<void> {
  const client = createSessionClient({ url: sessionWsUrl });
  try {
    await client.addProject({ cwd });
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15_000) {
      const groups = await client.getSessionGroups({ updatedWithinDays: null });
      if (
        groups.groups.some(
          (group) => group.cwd === cwd && group.sessions.length > 0,
        )
      ) {
        return;
      }
      await delay(250);
    }
  } finally {
    client.close();
  }
  throw new Error(`timed out waiting for indexed desktop sessions in ${cwd}`);
}

async function waitForDesktopWindow(
  run: DesktopRun,
  runRoot: string,
): Promise<Page> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const page = run.browser
      .contexts()
      .flatMap((context) => context.pages())[0];
    if (page !== undefined) {
      return page;
    }
    await delay(500);
  }
  throw new Error(
    `desktop window did not open\n${await readDiagnostics(runRoot, run.logs)}`,
  );
}

async function waitForCdpEndpoint(
  port: number,
  electronProcess: ChildProcess,
  logs: string[],
): Promise<string> {
  const deadline = Date.now() + 30_000;
  const url = `http://127.0.0.1:${String(port)}/json/version`;
  while (Date.now() < deadline) {
    if (electronProcess.exitCode !== null) {
      throw new Error(
        `Electron exited before CDP was ready\n${logs.join("\n")}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        const payload = (await response.json()) as {
          readonly webSocketDebuggerUrl?: string;
        };
        if (payload.webSocketDebuggerUrl !== undefined) {
          return payload.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Electron is still starting.
    }
    await delay(250);
  }
  throw new Error(`timed out waiting for Electron CDP\n${logs.join("\n")}`);
}

async function fetchRelaySnapshot(
  relayEndpoint: string,
  serverId: string,
): Promise<RelaySnapshot> {
  const url = new URL(`${relayEndpoint}/__conduit_test/snapshot`);
  url.searchParams.set("serverId", serverId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `relay snapshot failed ${String(response.status)}: ${await response.text()}`,
    );
  }
  return (await response.json()) as RelaySnapshot;
}

async function stopDesktop(run: DesktopRun | null): Promise<void> {
  if (run === null) {
    return;
  }
  await run.browser.close().catch(() => undefined);
  await stopElectronProcess(run.electron);
}

async function stopElectronProcess(
  electronProcess: ChildProcess,
): Promise<void> {
  if (
    electronProcess.exitCode !== null ||
    electronProcess.signalCode !== null
  ) {
    return;
  }
  signalElectronProcess(electronProcess, "SIGTERM");
  if (await waitForExit(electronProcess, 2_000)) {
    return;
  }
  signalElectronProcess(electronProcess, "SIGKILL");
  await waitForExit(electronProcess, 2_000);
}

function signalElectronProcess(
  electronProcess: ChildProcess,
  signal: "SIGKILL" | "SIGTERM",
): void {
  const pid = electronProcess.pid;
  if (pid === undefined) {
    return;
  }
  if (process.platform === "win32") {
    electronProcess.kill(signal);
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

function waitForExit(
  electronProcess: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (
    electronProcess.exitCode !== null ||
    electronProcess.signalCode !== null
  ) {
    return Promise.resolve(true);
  }
  return new Promise((resolveExit) => {
    const timeout = setTimeout(() => {
      electronProcess.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);
    const onExit = (): void => {
      clearTimeout(timeout);
      resolveExit(true);
    };
    electronProcess.once("exit", onExit);
  });
}

function appendLogs(logs: string[], chunk: string): void {
  logs.push(
    ...String(chunk)
      .split(/\r?\n/u)
      .filter((line) => line.length > 0),
  );
  while (logs.length > 120) {
    logs.shift();
  }
}

async function readDiagnostics(
  runRoot: string,
  electronLogs: readonly string[],
): Promise<string> {
  const backendLog = await readText(join(runRoot, "logs", "backend.log"));
  return JSON.stringify({ backendLog, electronLogs }, null, 2);
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    return `unavailable: ${errorMessage(error)}`;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

export { startDesktopE2eHarness };
export type { DesktopE2eHarness };
