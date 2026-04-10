import type {
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/session-model";

export const LOCKED_METHODS = [
  "initialize",
  "session/new",
  "session/list",
  "session/load",
  "session/prompt",
  "session/cancel",
] as const;

export type LockedMethod = (typeof LOCKED_METHODS)[number];

export const DESKTOP_ACTIONS = [
  "connect",
  "new",
  "list",
  "load",
  "prompt",
  "cancel",
] as const;

export type DesktopAction = (typeof DESKTOP_ACTIONS)[number];

export interface DesktopProofRequest {
  provider: ProviderId;
  action: DesktopAction;
  cwd: string;
  prompt?: string;
  cancelAfterMs?: number;
}

export interface DesktopProofResult {
  provider: ProviderId;
  action: DesktopAction;
  artifactRoot: string;
  snapshot: ProviderSnapshot;
  requests: unknown[];
  responses: unknown[];
  events: RawWireEvent[];
  summary: string;
  lastSessionId: string | null;
}
