import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SentryMockModule } from "../../test/sentry-react-native.mock";

const FLUSH_INTERVAL_MS = 1000;

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type FetchMock = ReturnType<typeof vi.fn<FetchFunction>>;

interface FrontendLoggerModule {
  initializeFrontendLogging: () => void;
  logFailure: (
    eventName: string,
    error: unknown,
    fields?: Record<string, unknown>,
  ) => void;
  logInfo: (eventName: string, fields?: Record<string, unknown>) => void;
}

function okResponse(): Response {
  return new Response(null, { status: 204 });
}

function configureLoggerTestRuntime(
  profile: string,
  withSentryDsn = true,
): void {
  vi.stubGlobal("navigator", { product: "ReactNative" });
  process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE = profile;
  process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL =
    "ws://127.0.0.1:4274/api/session";
  if (withSentryDsn) {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
  } else {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  }
}

function readPostedRecords(fetchMock: FetchMock): unknown[] {
  const [, requestInit] = fetchMock.mock.calls[0] ?? [];
  const body = requestInit?.body;
  if (typeof body !== "string") {
    throw new TypeError("Expected string log request body.");
  }
  const parsed: unknown = JSON.parse(body);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "records" in parsed &&
    Array.isArray(parsed.records)
  ) {
    return parsed.records;
  }
  return [];
}

async function setupLogger(
  fetchMock: FetchMock,
  profile = "stage",
  withSentryDsn = true,
): Promise<FrontendLoggerModule> {
  vi.resetModules();
  configureLoggerTestRuntime(profile, withSentryDsn);
  vi.stubGlobal("fetch", fetchMock);
  const logger = await import("./frontend-logger");
  logger.initializeFrontendLogging();
  await vi.runOnlyPendingTimersAsync();
  fetchMock.mockClear();
  return logger;
}

async function importSentryMock(): Promise<SentryMockModule> {
  const sentryMock = await import("../../test/sentry-react-native.mock");
  return sentryMock;
}

function expectSentryRuntimeTags(sentryMock: SentryMockModule): void {
  expect(sentryMock.setTag).toHaveBeenCalledWith(
    "conduit.runtime_surface",
    "mobile_app",
  );
}

function expectSentryBreadcrumbLog(sentryMock: SentryMockModule): void {
  expect(sentryMock.logger.info).toHaveBeenCalledWith(
    "frontend.sentry.breadcrumb",
    expect.objectContaining({
      endpoint_name: "settings/get",
      event_name: "frontend.sentry.breadcrumb",
      log_profile: "stage",
      runtime_platform: "native",
      runtime_surface: "mobile_app",
    }),
  );
}

function expectSentryInitialized(sentryMock: SentryMockModule): void {
  expect(sentryMock.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: "https://public@example.com/1",
      enableLogs: true,
      environment: "stage",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    }),
  );
  expect(sentryMock.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      category: "frontend",
      level: "info",
      message: "frontend.sentry.breadcrumb",
    }),
  );
}

async function resetFrontendLoggerTestState(): Promise<void> {
  delete process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE;
  delete process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  delete process.env.EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL;
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryMock = await importSentryMock();
  sentryMock.resetSentryMock();
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

async function runSentryInitializationCase(): Promise<void> {
  const fetchMock = vi.fn<FetchFunction>().mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.sentry.breadcrumb", {
    endpoint_name: "settings/get",
  });
  const sentryMock = await importSentryMock();

  expectSentryInitialized(sentryMock);
  expectSentryBreadcrumbLog(sentryMock);
  expectSentryRuntimeTags(sentryMock);
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expect(sentryMock.flush).toHaveBeenCalledWith();
}

function expectFailureRecord(record: unknown): void {
  expect(record).toMatchObject({
    event_name: "frontend.sentry.failure",
    error: {
      message: "boom",
      name: "Error",
    },
    route_capability: "[redacted]",
  });
}

function expectFileSinkFailureRecord(fetchMock: FetchMock): void {
  expect(fetchMock.mock.calls).toHaveLength(1);
  const [record] = readPostedRecords(fetchMock);
  expectFailureRecord(record);
}

async function runSentryFailureCase(): Promise<void> {
  const fetchMock = vi.fn<FetchFunction>().mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock);
  const error = new Error("boom");

  logger.logFailure("frontend.sentry.failure", error, {
    route_capability: "secret-capability",
  });
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  const sentryMock = await importSentryMock();

  expect(sentryMock.captureException).toHaveBeenCalledWith(error);
  expectFileSinkFailureRecord(fetchMock);
}

async function runProdSentryDsnCase(): Promise<void> {
  const fetchMock = vi.fn<FetchFunction>().mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock, "prod");

  logger.logInfo("frontend.sentry.prod_breadcrumb");
  const sentryMock = await importSentryMock();

  expect(sentryMock.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: "https://public@example.com/1",
      environment: "prod",
    }),
  );
  expect(sentryMock.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "frontend.sentry.prod_breadcrumb",
    }),
  );
  expect(sentryMock.logger.info).toHaveBeenCalledWith(
    "frontend.sentry.prod_breadcrumb",
    expect.objectContaining({
      event_name: "frontend.sentry.prod_breadcrumb",
      log_profile: "prod",
    }),
  );
  expect(fetchMock.mock.calls).toHaveLength(0);
}

async function runNoDsnSentryInitCase(): Promise<void> {
  const fetchMock = vi.fn<FetchFunction>().mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock, "dev", false);

  logger.logInfo("frontend.sentry.no_dsn");
  const sentryMock = await importSentryMock();

  expect(sentryMock.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: undefined,
      enabled: false,
      environment: "dev",
      sendDefaultPii: false,
    }),
  );
  expect(sentryMock.addBreadcrumb).not.toHaveBeenCalled();
  expect(sentryMock.captureMessage).not.toHaveBeenCalled();
}

describe("frontend logger Sentry sink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(resetFrontendLoggerTestState);

  it(
    "initializes Sentry from the same logger path when a DSN is configured",
    runSentryInitializationCase,
  );
  it(
    "captures failures as Sentry exceptions and keeps the file sink active",
    runSentryFailureCase,
  );
  it("enables Sentry in prod when a DSN is configured", runProdSentryDsnCase);
  it(
    "initializes disabled Sentry before root wrapping without a DSN",
    runNoDsnSentryInitCase,
  );
});
