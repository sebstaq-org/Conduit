import { app, dialog } from "electron";
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import type { ChildProcess } from "node:child_process";
import type { StageRuntimeConfig } from "./types.js";

const backendShutdownTimeoutMs = 3000;
const maxBackendStderrTailLength = 8192;

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

function appendTail(current: string, chunk: string): string {
  const next = `${current}${chunk}`;
  if (next.length <= maxBackendStderrTailLength) {
    return next;
  }
  return next.slice(next.length - maxBackendStderrTailLength);
}

function formatUnexpectedExitMessage(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderrTail: string,
): string {
  const base = `backend exited unexpectedly with code=${String(code)} signal=${String(signal)}`;
  const detail = stderrTail.trim();
  if (detail.length === 0) {
    return base;
  }
  return `${base}\n\nstderr tail:\n${detail}`;
}

class StageBackend {
  readonly #config: StageRuntimeConfig;
  readonly #onUnexpectedExit: (message: string) => void;
  #backendProcess: ChildProcess | null = null;
  #backendStderrTail = "";
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
    this.#backendStderrTail = "";
    const child = spawn(this.#config.serviceBinPath, this.#serveArgs(), {
      env: backendEnvironment(this.#config),
      stdio: ["ignore", "ignore", "pipe"],
    });
    this.#backendProcess = child;
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string | Buffer) => {
      let text = chunk.toString("utf8");
      if (typeof chunk === "string") {
        text = chunk;
      }
      this.#backendStderrTail = appendTail(this.#backendStderrTail, text);
    });
    child.once("error", (error) => {
      this.#handleUnexpectedFailure(`backend spawn failed: ${error.message}`);
    });
    child.once("close", (code, signal) => {
      this.#backendProcess = null;
      rmSync(this.#config.backendPidPath, { force: true });
      if (!this.#shuttingDown) {
        this.#handleUnexpectedFailure(
          formatUnexpectedExitMessage(code, signal, this.#backendStderrTail),
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
    this.#backendStderrTail = "";
    onStopped();
  }
}

export { StageBackend };
