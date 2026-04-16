import { frontendEnvValue } from "./frontend-env";
import { postRecords, shouldRetryIngest } from "./frontend-logger-ingest";
import { sanitizeUnknown } from "./frontend-logger-serialize";
import type {
  FrontendLogFields,
  FrontendLogLevel,
  FrontendLogProfile,
  FrontendLogRecord,
} from "./frontend-logger-types";

const WS_URL_ENV = "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL";
const MAX_BATCH_SIZE = 64;
const MAX_QUEUE_SIZE = 4096;
const FLUSH_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 2000;

const queue: FrontendLogRecord[] = [];

let flushInFlight = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let globalHandlersInstalled = false;
let initialized = false;
let profile: FrontendLogProfile = "prod";
let sinkUrl: string | null = null;
let triggerFlush: (() => void) | null = null;

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

function parseWsUrl(): URL {
  const configuredWsUrl = frontendEnvValue(
    "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL",
  );
  if (configuredWsUrl === undefined) {
    throw new Error(
      `${WS_URL_ENV} is required when frontend logging is enabled.`,
    );
  }
  const wsUrl = configuredWsUrl.trim();
  if (wsUrl.length === 0) {
    throw new Error(
      `${WS_URL_ENV} must not be empty when frontend logging is enabled.`,
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

function configuredClientLogUrl(): string {
  const override = resolveClientLogOverride();
  if (override !== null) {
    return override;
  }
  return buildClientLogUrlFromWs(parseWsUrl());
}

function recordWithFields(
  level: FrontendLogLevel,
  eventName: string,
  fields: FrontendLogFields,
): FrontendLogRecord {
  const record: FrontendLogRecord = {
    event_name: eventName,
    level,
    log_profile: profile,
    source: "frontend",
    timestamp: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(fields)) {
    record[key] = sanitizeUnknown(value);
  }
  return record;
}

function enqueueRecord(record: FrontendLogRecord): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }
  queue.push(record);
}

function requeueRecords(records: FrontendLogRecord[]): void {
  while (records.length > 0 && queue.length < MAX_QUEUE_SIZE) {
    const record = records.pop();
    if (record !== undefined) {
      queue.unshift(record);
    }
  }
}

async function tryFlushRecords(records: FrontendLogRecord[]): Promise<boolean> {
  if (sinkUrl === null) {
    return false;
  }
  try {
    await postRecords(records, sinkUrl);
    return false;
  } catch (error) {
    const shouldRetry = shouldRetryIngest(error);
    if (shouldRetry) {
      requeueRecords(records);
    }
    return shouldRetry;
  }
}

function scheduleDeferredFlush(shouldRetry: boolean): void {
  if (queue.length === 0 || flushTimer !== null) {
    return;
  }
  let delayMs = 0;
  if (shouldRetry) {
    delayMs = RETRY_DELAY_MS;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (triggerFlush !== null) {
      triggerFlush();
    }
  }, delayMs);
}

async function flushQueue(): Promise<void> {
  if (flushInFlight || queue.length === 0) {
    return;
  }
  flushInFlight = true;
  const records = queue.splice(0, MAX_BATCH_SIZE);
  const shouldRetry = await tryFlushRecords(records);
  flushInFlight = false;
  scheduleDeferredFlush(shouldRetry);
}
triggerFlush = (): void => {
  void flushQueue();
};

function scheduleFlush(delayMs: number): void {
  if (flushTimer !== null) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delayMs);
}

function emitInitializedRecord(
  level: FrontendLogLevel,
  eventName: string,
  fields: FrontendLogFields,
): void {
  if (sinkUrl === null) {
    return;
  }
  enqueueRecord(recordWithFields(level, eventName, fields));
  scheduleFlush(0);
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

function initializeFrontendLogging(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  profile = normalizeProfile(configuredLogProfile());
  if (profile !== "dev" && profile !== "stage") {
    return;
  }
  sinkUrl = configuredClientLogUrl();
  installGlobalHandlers();
  emitInitializedRecord("info", "frontend.logging.initialized", {
    log_profile: profile,
  });
}

function logEvent(
  level: FrontendLogLevel,
  eventName: string,
  fields: FrontendLogFields = {},
): void {
  if (!initialized) {
    initializeFrontendLogging();
  }
  if (sinkUrl === null) {
    return;
  }
  enqueueRecord(recordWithFields(level, eventName, fields));
  scheduleFlush(FLUSH_INTERVAL_MS);
}

function logDebug(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent("debug", eventName, fields);
}

function logInfo(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent("info", eventName, fields);
}

function logWarn(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent("warn", eventName, fields);
}

function logError(eventName: string, fields: FrontendLogFields = {}): void {
  logEvent("error", eventName, fields);
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
  logEvent("error", eventName, mergedFields);
}

export {
  initializeFrontendLogging,
  logDebug,
  logError,
  logFailure,
  logInfo,
  logWarn,
};
