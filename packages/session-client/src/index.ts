import { getProviderDescriptor } from "@conduit/provider-catalog";
import {
  LOCKED_METHODS,
  type ProviderConnectionSnapshot,
  type SessionListProjection,
} from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

export interface SessionClientPort {
  readonly policy: "official-acp-only";
  readonly lockedMethods: readonly string[];
  getProviderSnapshot(
    provider: ProviderId,
  ): Promise<ProviderConnectionSnapshot>;
  listSessions(): Promise<SessionListProjection>;
}

class BootstrapSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";
  public readonly lockedMethods = LOCKED_METHODS;

  public getProviderSnapshot(
    provider: ProviderId,
  ): Promise<ProviderConnectionSnapshot> {
    const descriptor = getProviderDescriptor(provider);

    return Promise.resolve({
      provider,
      ready: false,
      launcherPolicy: "official-acp-only",
      note: `Phase 0.5 reserves ${descriptor.launcher} without launching it yet.`,
    });
  }

  public listSessions(): Promise<SessionListProjection> {
    return Promise.resolve({
      source: "acp-runtime",
      sessions: [],
    });
  }
}

export function createBootstrapSessionClient(): SessionClientPort {
  return new BootstrapSessionClient();
}
