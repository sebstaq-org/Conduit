import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import { contextBridge, ipcRenderer } from "electron";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import { createSessionClient } from "@conduit/session-client";
import { PROVIDERS } from "@conduit/session-model";

interface ConduitRuntimeConfig {
  readonly clientLogUrl?: string;
  readonly logProfile?: string;
  readonly sessionWsUrl?: string;
}

const desktopIpcChannels = {
  copyText: "conduitDesktop:copyText",
  getDaemonStatus: "conduitDesktop:getDaemonStatus",
  getPairingOffer: "conduitDesktop:getPairingOffer",
  restartDaemon: "conduitDesktop:restartDaemon",
} as const;

const supportedSessionClientMethods = ["getSessionGroups"] as const;

interface DesktopBootstrapPlan {
  appId: "desktop";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedClientMethods: string[];
  supportedProviders: string[];
}

function createDesktopBootstrapPlan(): DesktopBootstrapPlan {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createProofSurfaceCopy("desktop"),
    lockedPolicy: sessionClient.policy,
    supportedClientMethods: [...supportedSessionClientMethods],
    supportedProviders: [...PROVIDERS],
  };
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    return null;
  }
  return value;
}

function desktopRuntimeConfig(): ConduitRuntimeConfig | null {
  if (process.env.CONDUIT_DESKTOP_DAEMON !== "1") {
    return null;
  }
  const host = envValue("CONDUIT_DESKTOP_BACKEND_HOST") ?? "127.0.0.1";
  const port = envValue("CONDUIT_DESKTOP_BACKEND_PORT") ?? "4174";
  return {
    clientLogUrl: `http://${host}:${port}/api/client-log`,
    logProfile: "dev",
    sessionWsUrl: `ws://${host}:${port}/api/session`,
  };
}

async function invokeUnknown(
  channel: string,
  value?: string,
): Promise<unknown> {
  const result: unknown = await ipcRenderer.invoke(channel, value);
  return result;
}

contextBridge.exposeInMainWorld("conduitDesktop", {
  copyText: async (value: string): Promise<boolean> => {
    const result = await invokeUnknown(desktopIpcChannels.copyText, value);
    return result === true;
  },
  getDaemonStatus: async (): Promise<unknown> => {
    const status = await invokeUnknown(desktopIpcChannels.getDaemonStatus);
    return status;
  },
  getPairingOffer: async (): Promise<unknown> => {
    const offer = await invokeUnknown(desktopIpcChannels.getPairingOffer);
    return offer;
  },
  restartDaemon: async (): Promise<unknown> => {
    const status = await invokeUnknown(desktopIpcChannels.restartDaemon);
    return status;
  },
});

const runtimeConfig = desktopRuntimeConfig();
if (runtimeConfig !== null) {
  contextBridge.exposeInMainWorld("CONDUIT_RUNTIME_CONFIG", runtimeConfig);
}

export { createDesktopBootstrapPlan };
