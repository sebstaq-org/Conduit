import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readDaemonStatusPayload } from "./backend-status-payload.js";
import type { ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import type { DesktopDaemonConfig, DesktopDaemonStatus } from "./types.js";

const shutdownTimeoutMs = 3000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function signalChild(child: ChildProcess, signal: "SIGKILL" | "SIGTERM"): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill(signal);
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    await Promise.resolve();
    return true;
  }
  const deferred = Promise.withResolvers<boolean>();
  let timeoutRef: ReturnType<typeof setTimeout> | null = null;
  const onExit = (): void => {
    if (timeoutRef !== null) {
      clearTimeout(timeoutRef);
    }
    deferred.resolve(true);
  };
  timeoutRef = setTimeout(() => {
    child.off("exit", onExit);
    deferred.resolve(false);
  }, timeoutMs);
  child.once("exit", onExit);
  const exited = await deferred.promise;
  return exited;
}

async function terminateChild(child: ChildProcess): Promise<void> {
  signalChild(child, "SIGTERM");
  if (await waitForExit(child, shutdownTimeoutMs)) {
    return;
  }
  signalChild(child, "SIGKILL");
  await waitForExit(child, shutdownTimeoutMs);
}

class DesktopDaemonController {
  readonly #config: DesktopDaemonConfig;
  #backendLogStream: WriteStream | null = null;
  #backendProcess: ChildProcess | null = null;
  #lastExit: string | null = null;
  #lifecycle: Promise<null> = Promise.resolve(null);
  #restartCount = 0;
  #stopping = false;

  constructor(config: DesktopDaemonConfig) {
    this.#config = config;
  }

  get serviceUrl(): string {
    return `http://${this.#config.backendHost}:${String(this.#config.backendPort)}`;
  }

  get sessionWsUrl(): string {
    return `ws://${this.#config.backendHost}:${String(this.#config.backendPort)}/api/session`;
  }

  async start(): Promise<void> {
    await this.#enqueueLifecycle(async () => {
      await this.#startNow();
    });
  }

  async restart(): Promise<DesktopDaemonStatus> {
    await Promise.resolve();
    return this.#enqueueLifecycle(async () => {
      this.#restartCount += 1;
      await this.#stopNow();
      try {
        await this.#startNow();
      } catch {
        // Recovery state is exposed through status; restart should not hide UI.
      }
      return this.#statusNow();
    });
  }

  async status(): Promise<DesktopDaemonStatus> {
    await this.waitForStableLifecycle();
    return this.#statusNow();
  }

  async stop(): Promise<void> {
    await this.#enqueueLifecycle(async () => {
      await this.#stopNow();
    });
  }

  async waitForStableLifecycle(): Promise<void> {
    await this.#lifecycle;
  }

  async #startNow(): Promise<void> {
    if (this.#backendProcess !== null) {
      return;
    }
    await this.#spawnNextBackend();
    try {
      await this.#waitHealthy();
      this.#lastExit = null;
    } catch (error) {
      this.#lastExit = errorMessage(error);
      await this.#stopNow();
      throw error;
    }
  }

  async #spawnNextBackend(): Promise<void> {
    this.#stopping = false;
    await this.#prepareRunDirectories();
    const child = this.#spawnBackend();
    this.#backendProcess = child;
    this.#bindBackendProcess(child);
  }

  async #stopNow(): Promise<void> {
    this.#stopping = true;
    const child = this.#backendProcess;
    this.#backendProcess = null;
    if (child !== null) {
      await terminateChild(child);
    }
    this.#closeLogStream();
  }

  async #statusNow(): Promise<DesktopDaemonStatus> {
    const daemon = await this.#fetchDaemonStatus();
    let sessionWsUrl: string | null = null;
    if (daemon !== null) {
      sessionWsUrl = this.sessionWsUrl;
    }
    return {
      appBaseUrl: this.#config.appBaseUrl,
      backendHealthy: daemon !== null,
      daemon,
      lastExit: this.#lastExit,
      mobilePeerConnected:
        daemon?.presence.clients.some((client) => client.connected) ?? false,
      pairingConfigured: daemon?.pairingConfigured ?? false,
      pid: this.#backendProcess?.pid ?? null,
      presence: daemon?.presence ?? null,
      relayConfigured: this.#config.relayEndpoint.length > 0,
      relayEndpoint: this.#config.relayEndpoint,
      restartCount: this.#restartCount,
      running: this.#backendProcess !== null,
      sessionWsUrl,
    };
  }

  async #prepareRunDirectories(): Promise<void> {
    await mkdir(this.#config.home, { recursive: true });
    await mkdir(dirname(this.#config.backendLogPath), { recursive: true });
  }

  #spawnBackend(): ChildProcess {
    this.#backendLogStream = createWriteStream(this.#config.backendLogPath, {
      flags: "a",
    });
    const child = spawn(this.#config.serviceBinPath, this.#serveArgs(), {
      env: this.#backendEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.pipe(this.#backendLogStream, { end: false });
    child.stderr?.pipe(this.#backendLogStream, { end: false });
    return child;
  }

  #bindBackendProcess(child: ChildProcess): void {
    child.once("error", (error) => {
      this.#lastExit = `spawn failed: ${error.message}`;
    });
    child.once("close", (code, signal) => {
      this.#backendProcess = null;
      this.#closeLogStream();
      if (!this.#stopping) {
        this.#lastExit = `exited code=${String(code)} signal=${String(signal)}`;
      }
    });
  }

  #serveArgs(): string[] {
    const args = [
      "serve",
      "--host",
      this.#config.backendHost,
      "--port",
      String(this.#config.backendPort),
      "--relay-endpoint",
      this.#config.relayEndpoint,
      "--app-base-url",
      this.#config.appBaseUrl,
    ];
    if (this.#config.providerFixtures !== null) {
      args.push("--provider-fixtures", this.#config.providerFixtures);
    }
    if (this.#config.storePath !== null) {
      args.push("--store-path", this.#config.storePath);
    }
    return args;
  }

  #backendEnvironment(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    env.CONDUIT_HOME = this.#config.home;
    env.CONDUIT_LOG_PROFILE = "dev";
    env.XDG_DATA_HOME = this.#config.home;
    return env;
  }

  async #waitHealthy(): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (this.#backendProcess === null) {
        throw new Error(
          this.#lastExit ?? "desktop daemon exited before health",
        );
      }
      try {
        const response = await fetch(`${this.serviceUrl}/health`);
        if (response.ok) {
          return;
        }
      } catch {
        await delay(250);
      }
    }
    throw new Error("timed out waiting for desktop daemon health");
  }

  async #fetchDaemonStatus(): Promise<DesktopDaemonStatus["daemon"]> {
    try {
      const response = await fetch(`${this.serviceUrl}/api/daemon/status`);
      if (!response.ok) {
        return null;
      }
      return readDaemonStatusPayload(await response.json());
    } catch {
      return null;
    }
  }

  #closeLogStream(): void {
    this.#backendLogStream?.end();
    this.#backendLogStream = null;
  }

  async #enqueueLifecycle<Result>(
    task: () => Promise<Result>,
  ): Promise<Result> {
    const previous = this.#lifecycle;
    const next = Promise.withResolvers<null>();
    this.#lifecycle = next.promise;
    await previous;
    try {
      const result = await task();
      return result;
    } finally {
      next.resolve(null);
    }
  }
}

export { DesktopDaemonController };
