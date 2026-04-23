import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import type { DesktopDaemonConfig, DesktopDaemonStatus } from "./types.js";

const shutdownTimeoutMs = 3000;

interface DaemonStatusPayload {
  readonly pairingConfigured: boolean;
  readonly relayEndpoint: string | null;
  readonly serverId: string;
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
    return true;
  }
  const deferred = Promise.withResolvers<boolean>();
  const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
    current: null,
  };
  const onExit = (): void => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    deferred.resolve(true);
  };
  timeoutRef.current = setTimeout(() => {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function optionalStringValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function readDaemonStatusPayload(value: unknown): DaemonStatusPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const pairingConfigured = booleanValue(value.pairingConfigured);
  const relayEndpoint = optionalStringValue(value.relayEndpoint);
  const serverId = stringValue(value.serverId);
  if (
    pairingConfigured === null ||
    relayEndpoint === undefined ||
    serverId === null
  ) {
    return null;
  }
  return {
    pairingConfigured,
    relayEndpoint,
    serverId,
  };
}

class DesktopDaemonController {
  readonly #config: DesktopDaemonConfig;
  #backendLogStream: WriteStream | null = null;
  #backendProcess: ChildProcess | null = null;
  #lastExit: string | null = null;
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
    if (this.#backendProcess !== null) {
      return;
    }
    this.#stopping = false;
    await this.#prepareRunDirectories();
    const child = this.#spawnBackend();
    this.#backendProcess = child;
    this.#bindBackendProcess(child);
    await this.#waitHealthy();
  }

  async restart(): Promise<DesktopDaemonStatus> {
    this.#restartCount += 1;
    await this.stop();
    await this.start();
    return this.status();
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    const child = this.#backendProcess;
    this.#backendProcess = null;
    if (child !== null) {
      await terminateChild(child);
    }
    this.#closeLogStream();
  }

  async status(): Promise<DesktopDaemonStatus> {
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
      pairingConfigured: daemon?.pairingConfigured ?? false,
      pid: this.#backendProcess?.pid ?? null,
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
}

export { DesktopDaemonController };
