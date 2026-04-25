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
  getRuntimeConfig: "conduitDesktop:getRuntimeConfig",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function runtimeConfigEntries(
  value: Record<string, unknown>,
): (readonly [keyof ConduitRuntimeConfig, string | undefined])[] {
  return [
    ["clientLogUrl", optionalString(value.clientLogUrl)],
    ["logProfile", optionalString(value.logProfile)],
    ["sessionWsUrl", optionalString(value.sessionWsUrl)],
  ];
}

function desktopRuntimeConfig(): ConduitRuntimeConfig | null {
  const value: unknown = ipcRenderer.sendSync(
    desktopIpcChannels.getRuntimeConfig,
  );
  if (!isRecord(value)) {
    return null;
  }
  return Object.fromEntries(
    runtimeConfigEntries(value).filter((entry) => entry[1] !== undefined),
  ) as ConduitRuntimeConfig;
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
