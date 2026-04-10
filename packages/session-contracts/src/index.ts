import type { ProviderId, SessionSnapshot } from "@conduit/session-model";

export const LOCKED_METHODS = [
  "initialize",
  "session/new",
  "session/list",
  "session/load",
  "session/prompt",
  "session/cancel",
] as const;

export type LockedMethod = (typeof LOCKED_METHODS)[number];

export interface ProviderConnectionSnapshot {
  provider: ProviderId;
  ready: boolean;
  launcherPolicy: "official-acp-only";
  note: string;
}

export interface SessionListProjection {
  source: "acp-runtime";
  sessions: SessionSnapshot[];
}

export interface BootstrapBoundary {
  phase: "0.5";
  lockedMethods: readonly LockedMethod[];
}

export function createBootstrapBoundary(): BootstrapBoundary {
  return {
    phase: "0.5",
    lockedMethods: LOCKED_METHODS,
  };
}
