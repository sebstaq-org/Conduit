import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  StageRuntimeConfig,
  StageRuntimeStatus,
  StageServiceStatus,
} from "./types.js";

const unknownBuild = "unknown";

function startingService(message: string): StageServiceStatus {
  return {
    healthMessage: message,
    healthy: false,
    pid: null,
    status: "starting",
  };
}

function stoppedService(message: string): StageServiceStatus {
  return {
    healthMessage: message,
    healthy: false,
    pid: null,
    status: "stopped",
  };
}

function healthyService(
  message: string,
  pid: number | null,
): StageServiceStatus {
  return {
    healthMessage: message,
    healthy: true,
    pid,
    status: "healthy",
  };
}

function failedService(message: string): StageServiceStatus {
  return {
    healthMessage: message,
    healthy: false,
    pid: null,
    status: "failed",
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function readManifestCommit(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "commit" in payload &&
    typeof payload.commit === "string"
  ) {
    return payload.commit;
  }
  return unknownBuild;
}

function readBuildLabel(config: StageRuntimeConfig): string {
  try {
    const content = readFileSync(
      join(config.resourcesDir, "manifest.json"),
      "utf8",
    );
    return readManifestCommit(JSON.parse(content) as unknown);
  } catch {
    return unknownBuild;
  }
}

function runtimeStatusPayload(
  status: Omit<StageRuntimeStatus, "build" | "updatedAt">,
  build: string,
): StageRuntimeStatus {
  return {
    backend: status.backend,
    build,
    updatedAt: new Date().toISOString(),
    web: status.web,
  };
}

function writeRuntimeStatus(
  config: StageRuntimeConfig,
  status: Omit<StageRuntimeStatus, "build" | "updatedAt">,
): void {
  try {
    writeFileSync(
      config.statusPath,
      `${JSON.stringify(runtimeStatusPayload(status, readBuildLabel(config)), null, 2)}\n`,
      "utf8",
    );
  } catch (error: unknown) {
    const fallbackPayload = {
      backend: status.backend,
      build: unknownBuild,
      statusWriteError: errorMessage(error),
      updatedAt: new Date().toISOString(),
      web: status.web,
    };
    writeFileSync(
      config.statusPath,
      `${JSON.stringify(fallbackPayload, null, 2)}\n`,
      "utf8",
    );
  }
}

function prepareStageDirectories(config: StageRuntimeConfig): void {
  mkdirSync(config.dataRoot, { recursive: true });
  mkdirSync(join(config.dataRoot, "logs"), { recursive: true });
  mkdirSync(config.logDir, { recursive: true });
}

export {
  failedService,
  healthyService,
  prepareStageDirectories,
  startingService,
  stoppedService,
  writeRuntimeStatus,
};
