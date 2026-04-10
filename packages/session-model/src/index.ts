export const PROVIDERS = ["claude", "codex", "copilot"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export interface SessionIdentity {
  provider: ProviderId;
  acpSessionId: string;
}

export type SessionLifecycle = "disconnected" | "ready" | "busy";

export interface SessionSnapshot {
  identity: SessionIdentity;
  title: string;
  lifecycle: SessionLifecycle;
}

export function createSessionIdentity(
  provider: ProviderId,
  acpSessionId: string,
): SessionIdentity {
  return { provider, acpSessionId };
}

export function createSessionSnapshot(
  identity: SessionIdentity,
  title: string,
): SessionSnapshot {
  return { identity, title, lifecycle: "ready" };
}
