import {
  addBreadcrumb,
  captureException,
  captureMessage,
  init,
  logger as sentryLogger,
  setTag,
  withScope,
} from "@sentry/react-native";
import type { SeverityLevel } from "@sentry/react-native";
import { frontendEnvValue } from "./frontend-env";
import type {
  FrontendLogLevel,
  FrontendLogProfile,
  FrontendLogRecord,
  FrontendLogSink,
} from "./frontend-logger-types";

interface SentryLogSinkConfig {
  readonly dsn: string;
  readonly profile: FrontendLogProfile;
}

const SENTRY_DSN_ENV = "EXPO_PUBLIC_SENTRY_DSN";
const MAX_CONTEXT_FIELDS = 48;

let sentryInitialized = false;

function configuredSentryDsn(): string | null {
  const rawDsn = frontendEnvValue(SENTRY_DSN_ENV);
  if (rawDsn === undefined) {
    return null;
  }
  const dsn = rawDsn.trim();
  if (dsn.length === 0) {
    throw new Error(`${SENTRY_DSN_ENV} must not be empty when set.`);
  }
  return dsn;
}

function configuredRelease(): string | undefined {
  const release = frontendEnvValue("EXPO_PUBLIC_CONDUIT_RELEASE");
  if (release === undefined || release.trim().length === 0) {
    return undefined;
  }
  return release.trim();
}

function configuredDist(): string | undefined {
  const dist = frontendEnvValue("EXPO_PUBLIC_CONDUIT_DIST");
  if (dist === undefined || dist.trim().length === 0) {
    return undefined;
  }
  return dist.trim();
}

function sentryLevel(level: FrontendLogLevel): SeverityLevel {
  if (level === "warn") {
    return "warning";
  }
  return level;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function contextFromRecord(record: FrontendLogRecord): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (count >= MAX_CONTEXT_FIELDS) {
      context.truncated_context = true;
      return context;
    }
    context[key] = value;
    count += 1;
  }
  return context;
}

function isUnhandledBrowserRecord(record: FrontendLogRecord): boolean {
  return record.event_name.startsWith("frontend.unhandled_");
}

function normalizeError(error: unknown): Error | null {
  if (error instanceof Error) {
    return error;
  }
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return new Error(message);
    }
  }
  return null;
}

function initializeSentry(config: SentryLogSinkConfig): void {
  if (sentryInitialized) {
    return;
  }
  init({
    attachStacktrace: true,
    dist: configuredDist(),
    dsn: config.dsn,
    enableCaptureFailedRequests: false,
    enableLogs: true,
    environment: config.profile,
    release: configuredRelease(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  setTag("conduit.log_profile", config.profile);
  sentryInitialized = true;
}

function writeSentryRecord(record: FrontendLogRecord, error?: unknown): void {
  const context = contextFromRecord(record);
  sentryLogger[record.level](record.event_name, context);
  addBreadcrumb({
    category: "frontend",
    data: context,
    level: sentryLevel(record.level),
    message: record.event_name,
  });
  if (record.level !== "error" || isUnhandledBrowserRecord(record)) {
    return;
  }
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Sentry scopes are callback based.
  withScope((scope) => {
    scope.setTag("conduit.event_name", record.event_name);
    scope.setLevel(sentryLevel(record.level));
    scope.setContext("conduit.frontend_log", context);
    const normalizedError = normalizeError(error ?? record.error);
    if (normalizedError !== null) {
      captureException(normalizedError);
      return;
    }
    captureMessage(record.event_name, sentryLevel(record.level));
  });
}

function createSentryLogSink(
  profile: FrontendLogProfile,
): FrontendLogSink | null {
  const dsn = configuredSentryDsn();
  if (dsn === null) {
    return null;
  }
  initializeSentry({ dsn, profile });
  return {
    write: writeSentryRecord,
  };
}

export { createSentryLogSink };
