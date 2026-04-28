import { frontendEnvValue } from "./frontend-env";
import { FileLogSink } from "./frontend-logger-file-sink";
import { frontendRuntimeMetadata } from "./frontend-runtime-metadata";
import { sanitizeLogField, sanitizeUnknown } from "./frontend-logger-serialize";
import { createSentryLogSink } from "./frontend-logger-sentry";
import type {
  FrontendLogFields,
  FrontendLogLevel,
  FrontendLogProfile,
  FrontendLogRecord,
  FrontendLogSink,
} from "./frontend-logger-types";

const WS_URL_ENV = "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL";

let globalHandlersInstalled = false;
let initialized = false;
let profile: FrontendLogProfile = "prod";
let sinks: FrontendLogSink[] = [];

function normalizeProfile(raw: string | undefined): FrontendLogProfile {
  if (raw !== undefined) {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized === "dev" ||
      normalized === "stage" ||
      normalized === "prod"
    ) {
      return normalized;
    }
  }
  if (frontendEnvValue("NODE_ENV") === "development") {
    return "dev";
  }
  return "prod";
}

function configuredLogProfile(): string | undefined {
  return frontendEnvValue("EXPO_PUBLIC_CONDUIT_LOG_PROFILE");
}

function parseWsUrl(): URL | null {
  const configuredWsUrl = frontendEnvValue(
    "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL",
  );
  if (configuredWsUrl === undefined) {
    return null;
  }
  const wsUrl = configuredWsUrl.trim();
  if (wsUrl.length === 0) {
    throw new Error(
      `${WS_URL_ENV} must not be empty when frontend file logging is enabled.`,
    );
  }
  return new URL(wsUrl);
}

function resolveClientLogOverride(): string | null {
  const configuredOverride = frontendEnvValue(
    "EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL",
  );
  if (configuredOverride === undefined) {
    return null;
  }
  const override = configuredOverride.trim();
  if (override.length === 0) {
    return null;
  }
  return override;
}

function mapWsProtocolToHttp(protocol: string): string {
  const protocolByWebSocketScheme: Record<string, string> = {
    "ws:": "http:",
    "wss:": "https:",
  };
  return protocolByWebSocketScheme[protocol] ?? "http:";
}

function buildClientLogUrlFromWs(wsUrl: URL): string {
  wsUrl.protocol = mapWsProtocolToHttp(wsUrl.protocol);
  wsUrl.pathname = "/api/client-log";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}

function configuredClientLogUrl(): string | null {
  const override = resolveClientLogOverride();
  if (override !== null) {
    return override;
  }
  const wsUrl = parseWsUrl();
  if (wsUrl === null) {
    return null;
  }
  return buildClientLogUrlFromWs(wsUrl);
}

function recordWithFields(
  level: FrontendLogLevel,
  eventName: string,
  fields: FrontendLogFields,
): FrontendLogRecord {
  const runtimeMetadata = frontendRuntimeMetadata();
  const record: FrontendLogRecord = {
    event_name: eventName,
    level,
    log_profile: profile,
    runtime_platform: runtimeMetadata.runtime_platform,
    runtime_surface: runtimeMetadata.runtime_surface,
    source: "frontend",
    timestamp: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(fields)) {
    record[key] = sanitizeLogField(key, value);
  }
  return record;
}

function emitRecord(record: FrontendLogRecord, error?: unknown): void {
  for (const sink of sinks) {
    sink.write(record, error);
  }
}

function emitInitializedRecord(
  level: FrontendLogLevel,
  eventName: string,
  fields: FrontendLogFields,
): void {
  emitRecord(recordWithFields(level, eventName, fields));
  for (const sink of sinks) {
    if (sink instanceof FileLogSink) {
      sink.flushImmediately();
    }
  }
}

function installGlobalHandlers(): void {
  if (
    globalHandlersInstalled ||
    typeof globalThis.addEventListener !== "function"
  ) {
    return;
  }
  globalThis.addEventListener("error", (event) => {
    emitInitializedRecord("error", "frontend.unhandled_error", {
      column: event.colno,
      filename: event.filename,
      line: event.lineno,
      message: event.message,
      stack: sanitizeUnknown(event.error),
    });
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    emitInitializedRecord("error", "frontend.unhandled_rejection", {
      reason: sanitizeUnknown(event.reason),
    });
  });
  globalHandlersInstalled = true;
}

function createLogSinks(
  resolvedProfile: FrontendLogProfile,
): FrontendLogSink[] {
  const nextSinks: FrontendLogSink[] = [];
  const sentrySink = createSentryLogSink(resolvedProfile);
  if (sentrySink !== null) {
    nextSinks.push(sentrySink);
  }
  if (resolvedProfile !== "dev" && resolvedProfile !== "stage") {
    return nextSinks;
  }
  const fileSinkUrl = configuredClientLogUrl();
  if (fileSinkUrl !== null) {
    nextSinks.push(new FileLogSink(fileSinkUrl));
  }
  return nextSinks;
}

function initializeFrontendLogging(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  profile = normalizeProfile(configuredLogProfile());
  sinks = createLogSinks(profile);
  installGlobalHandlers();
  emitInitializedRecord("info", "frontend.logging.initialized", {
    log_profile: profile,
    sink_count: sinks.length,
  });
}

interface LogEventOptions {
  readonly error?: unknown;
  readonly eventName: string;
  readonly fields: FrontendLogFields;
  readonly level: FrontendLogLevel;
}

function logEvent({ error, eventName, fields, level }: LogEventOptions): void {
  if (!initialized) {
    initializeFrontendLogging();
  }
  if (sinks.length === 0) {
    return;
  }
  emitRecord(recordWithFields(level, eventName, fields), error);
}

function logDebug(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent({ eventName, fields, level: "debug" });
}

function logInfo(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent({ eventName, fields, level: "info" });
}

function logWarn(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent({ eventName, fields, level: "warn" });
}

function logError(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent({ eventName, fields, level: "error" });
}

function logFailure(
  eventName: string,
  error: unknown,
  fields: FrontendLogFields = {},
): void {
  const mergedFields: FrontendLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    mergedFields[key] = value;
  }
  mergedFields.error = sanitizeUnknown(error);
  logEvent({ error, eventName, fields: mergedFields, level: "error" });
}

export {
  initializeFrontendLogging,
  logDebug,
  logError,
  logFailure,
  logInfo,
  logWarn,
};
