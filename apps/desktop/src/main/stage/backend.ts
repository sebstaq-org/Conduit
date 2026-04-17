import { app, dialog } from "electron";
import { spawn } from "node:child_process";
import { createWriteStream, rmSync, writeFileSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import type { WriteStream } from "node:fs";
import type { StageRuntimeConfig } from "./types.js";

const backendShutdownTimeoutMs = 3000;

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

function stopChildProcess(child: ChildProcess, onStopped: () => void): void {
  let stopped = false;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  const finish = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (killTimer !== null) {
      clearTimeout(killTimer);
    }
    onStopped();
  };
  killTimer = setTimeout(() => {
    if (!stopped) {
      child.kill("SIGKILL");
    }
  }, backendShutdownTimeoutMs);
  killTimer.unref();
  child.once("close", finish);
  if (!child.kill("SIGTERM")) {
    finish();
  }
}

class StageBackend {
  readonly #config: StageRuntimeConfig;
  readonly #onUnexpectedExit: (message: string) => void;
  #backendProcess: ChildProcess | null = null;
  #backendLogStream: WriteStream | null = null;
  #shuttingDown = false;

  constructor(
    config: StageRuntimeConfig,
    onUnexpectedExit: (message: string) => void,
  ) {
    this.#config = config;
    this.#onUnexpectedExit = onUnexpectedExit;
  }

  get pid(): number | null {
    return this.#backendProcess?.pid ?? null;
  }

  get running(): boolean {
    return this.#backendProcess !== null;
  }

  start(): void {
    this.#backendLogStream = createWriteStream(this.#config.backendLogPath, {
      flags: "a",
    });
    const child = spawn(this.#config.serviceBinPath, this.#serveArgs(), {
      env: backendEnvironment(this.#config),
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.#backendProcess = child;
    child.stdout?.pipe(this.#backendLogStream, { end: false });
    child.stderr?.pipe(this.#backendLogStream, { end: false });
    child.once("error", (error) => {
      this.#handleUnexpectedFailure(`backend spawn failed: ${error.message}`);
    });
    child.once("close", (code, signal) => {
      this.#backendProcess = null;
      rmSync(this.#config.backendPidPath, { force: true });
      if (!this.#shuttingDown) {
        this.#handleUnexpectedFailure(
          `backend exited unexpectedly with code=${String(code)} signal=${String(signal)}`,
        );
      }
    });
    if (child.pid !== undefined) {
      writeFileSync(this.#config.backendPidPath, String(child.pid), "utf8");
    }
  }

  stop(onStopped: () => void): void {
    this.#shuttingDown = true;
    const child = this.#backendProcess;
    this.#backendProcess = null;
    if (child === null) {
      this.#finishStop(onStopped);
      return;
    }
    stopChildProcess(child, () => {
      this.#finishStop(onStopped);
    });
  }

  #serveArgs(): string[] {
    return [
      "serve",
      "--host",
      this.#config.backendHost,
      "--port",
      String(this.#config.backendPort),
    ];
  }

  #handleUnexpectedFailure(message: string): void {
    this.#onUnexpectedExit(message);
    dialog.showErrorBox("Conduit Stage backend stopped", message);
    app.quit();
  }

  #finishStop(onStopped: () => void): void {
    rmSync(this.#config.backendPidPath, { force: true });
    this.#backendLogStream?.end();
    this.#backendLogStream = null;
    onStopped();
  }
}

export { StageBackend };
