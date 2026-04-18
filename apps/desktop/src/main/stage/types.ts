import type { BrowserWindow } from "electron";
import type { Server } from "node:http";

type StageServiceStatusName = "failed" | "healthy" | "starting" | "stopped";

interface StageServiceStatus {
  readonly healthMessage: string;
  readonly healthy: boolean;
  readonly pid: number | null;
  readonly status: StageServiceStatusName;
}

interface StageRuntimeConfig {
  readonly backendHost: string;
  readonly backendLogPath: string;
  readonly backendPidPath: string;
  readonly backendPort: number;
  readonly dataRoot: string;
  readonly electronPidPath: string;
  readonly frontendLogPath: string;
  readonly logDir: string;
  readonly resourcesDir: string;
  readonly serviceBinPath: string;
  readonly statusPath: string;
  readonly webDir: string;
  readonly webHost: string;
  readonly webPort: number;
}

interface StageRuntimeStatus {
  readonly backend: StageServiceStatus;
  readonly build: string;
  readonly updatedAt: string;
  readonly web: StageServiceStatus;
}

interface StageRuntimeState {
  readonly windows: Set<BrowserWindow>;
  server: Server | null;
  shutdownComplete: boolean;
  shutdownStarted: boolean;
}

export type {
  StageRuntimeConfig,
  StageRuntimeState,
  StageRuntimeStatus,
  StageServiceStatus,
  StageServiceStatusName,
};
