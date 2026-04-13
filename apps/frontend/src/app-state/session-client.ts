import { createSessionClient } from "@conduit/session-client";
import type { SessionClientPort } from "@conduit/session-client";

function configuredSessionClientUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  if (configuredUrl === undefined) {
    throw new Error(
      "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL is required for frontend session transport.",
    );
  }
  const url = configuredUrl.trim();
  if (url.length === 0) {
    throw new Error(
      "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL must not be empty for frontend session transport.",
    );
  }
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    throw new Error(
      "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL must start with ws:// or wss://.",
    );
  }
  return url;
}

function configuredSessionHealthUrl(): string {
  const wsUrl = new URL(configuredSessionClientUrl());
  const protocolByWebSocketScheme: Record<string, string> = {
    "ws:": "http:",
    "wss:": "https:",
  };
  wsUrl.protocol = protocolByWebSocketScheme[wsUrl.protocol] ?? "http:";
  wsUrl.pathname = "/health";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}

const sessionClient: SessionClientPort = createSessionClient({
  url: configuredSessionClientUrl(),
});

export {
  configuredSessionClientUrl,
  configuredSessionHealthUrl,
  sessionClient,
};
export type { SessionClientPort };
