import type { ConnectionHostProfile } from "@conduit/app-client";
import type {
  SessionClientPort,
  SessionClientTelemetryEvent,
} from "@conduit/session-client";
import { frontendEnvValue } from "./frontend-env";
import { logDebug, logError, logInfo, logWarn } from "./frontend-logger";
import { readOrCreateClientIdentity } from "./client-identity";
import { SessionClientManager } from "./session-client-manager";
import { createUnconfiguredSessionClient } from "./session-client-unconfigured";

function optionalSessionClientUrl(): string | null {
  const configuredUrl = frontendEnvValue("EXPO_PUBLIC_CONDUIT_SESSION_WS_URL");
  if (configuredUrl === undefined) {
    return null;
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

function configuredSessionHealthUrl(): string | null {
  const configuredUrl = optionalSessionClientUrl();
  if (configuredUrl === null) {
    return null;
  }
  const wsUrl = new URL(configuredUrl);
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

function logSessionClientTelemetry(event: SessionClientTelemetryEvent): void {
  if (event.level === "debug") {
    logDebug(event.event_name, event.fields ?? {});
    return;
  }
  if (event.level === "info") {
    logInfo(event.event_name, event.fields ?? {});
    return;
  }
  if (event.level === "warn") {
    logWarn(event.event_name, event.fields ?? {});
    return;
  }
  logError(event.event_name, event.fields ?? {});
}

const sessionClientManager = new SessionClientManager(
  createUnconfiguredSessionClient(),
);
const directUrl = optionalSessionClientUrl();
if (directUrl !== null) {
  sessionClientManager.configureDirect(directUrl, logSessionClientTelemetry);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function configureClientPresence(revision: number): Promise<void> {
  try {
    sessionClientManager.configurePresence(
      revision,
      await readOrCreateClientIdentity(),
    );
  } catch (error: unknown) {
    logError("frontend.client_identity_failed", { error: errorMessage(error) });
  }
}

function configureSessionClientForHost(
  host: ConnectionHostProfile | null,
): void {
  if (host !== null) {
    const revision = sessionClientManager.configureRelay(
      host,
      logSessionClientTelemetry,
    );
    void configureClientPresence(revision);
    return;
  }
  const url = optionalSessionClientUrl();
  if (url !== null) {
    sessionClientManager.configureDirect(url, logSessionClientTelemetry);
    return;
  }
  sessionClientManager.configureUnconfigured(createUnconfiguredSessionClient());
}

const sessionClient: SessionClientPort = sessionClientManager;

export {
  configureSessionClientForHost,
  configuredSessionHealthUrl,
  sessionClient,
};
export type { SessionClientPort };
