type FrontendLogLevel = "debug" | "info" | "warn" | "error";
type FrontendLogProfile = "dev" | "stage" | "prod";
type FrontendLogFields = Record<string, unknown>;
interface FrontendLogRecord {
  event_name: string;
  level: FrontendLogLevel;
  log_profile: FrontendLogProfile;
  source: "frontend";
  timestamp: string;
  [field: string]: unknown;
}
const LOG_PROFILE_ENV = "EXPO_PUBLIC_CONDUIT_LOG_PROFILE";
const WS_URL_ENV = "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL";
const CLIENT_LOG_URL_ENV = "EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL";
const MAX_BATCH_SIZE = 64;
const MAX_QUEUE_SIZE = 4096;
const FLUSH_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 3000;
const RETRY_DELAY_MS = 2000;
const queue: FrontendLogRecord[] = [];
let flushInFlight = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let globalHandlersInstalled = false;
let initialized = false;
let profile: FrontendLogProfile = "prod";
let sinkUrl: string | null = null;
function isEnabledProfile(value: FrontendLogProfile): boolean {
  return value === "dev" || value === "stage";
}
function normalizeProfile(raw: string | undefined): FrontendLogProfile {
  if (raw !== undefined) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "dev" || normalized === "stage" || normalized === "prod") {
      return normalized;
    }
  }
  if (process.env.NODE_ENV === "development") {
    return "dev";
  }
  return "prod";
}

function configuredLogProfile(): string | undefined {
  return process.env[LOG_PROFILE_ENV];
}

function parseWsUrl(): URL {
  const configuredWsUrl = process.env[WS_URL_ENV];
  if (configuredWsUrl === undefined) {
    throw new Error(`${WS_URL_ENV} is required when frontend logging is enabled.`);
  }
  const wsUrl = configuredWsUrl.trim();
  if (wsUrl.length === 0) {
    throw new Error(`${WS_URL_ENV} must not be empty when frontend logging is enabled.`);
  }
  return new URL(wsUrl);
}
function resolveClientLogOverride(): string | null {
  const configuredOverride = process.env[CLIENT_LOG_URL_ENV];
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
function errorFields(error: Error): Record<string, string | null> {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack ?? null,
  };
}
function sanitizeUnknown(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  try {
    const serialized = JSON.stringify(value, (_key: string, current: unknown) => {
      if (current instanceof Error) {
        return errorFields(current);
      }
      if (typeof current === "bigint") {
        return current.toString();
      }
      return current;
    });
    if (serialized === undefined) {
      return null;
    }
    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof Error) {
      return errorFields(error);
    }
    return String(error);
  }
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
async function postRecords(records: FrontendLogRecord[]): Promise<void> {
  if (sinkUrl === null) {
    return;
  }
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(sinkUrl, {
      body: JSON.stringify({ records }),
      headers: { "content-type": "application/json" },
      keepalive: records.length <= 10,
      method: "POST",
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`client log ingestion failed (${response.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
function requeueRecords(records: FrontendLogRecord[]): void {
  while (records.length > 0 && queue.length < MAX_QUEUE_SIZE) {
    const record = records.pop();
    if (record !== undefined) {
      queue.unshift(record);
    }
  }
}
async function flushQueue(): Promise<void> {
  if (flushInFlight || queue.length === 0) {
    return;
  }
  flushInFlight = true;
  const records = queue.splice(0, MAX_BATCH_SIZE);
  let shouldRetry = false;
  try {
    await postRecords(records);
  } catch {
    shouldRetry = true;
    requeueRecords(records);
  } finally {
    flushInFlight = false;
    if (queue.length > 0 && flushTimer === null) {
      const retryDelay = shouldRetry ? RETRY_DELAY_MS : 0;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushQueue();
      }, retryDelay);
    }
  }
}
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
  if (globalHandlersInstalled || typeof globalThis.addEventListener !== "function") {
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
  if (!isEnabledProfile(profile)) {
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
