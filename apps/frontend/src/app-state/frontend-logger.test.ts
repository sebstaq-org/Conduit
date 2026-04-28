import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SentryMockModule } from "../../test/sentry-react-native.mock";

const FLUSH_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 2000;

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

function okResponse(status = 204): Response {
  return new Response(null, { status });
}

function failedResponse(status: number): Response {
  return new Response("", { status });
}

function createFetchMock(): FetchMock {
  return vi.fn<FetchFunction>();
}

function expectCallCount(fetchMock: FetchMock, expectedCount: number): void {
  expect(fetchMock.mock.calls).toHaveLength(expectedCount);
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
): Promise<FrontendLoggerModule> {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE = profile;
  process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL =
    "ws://127.0.0.1:4274/api/session";
  const logger = await import("./frontend-logger");
  logger.initializeFrontendLogging();
  await vi.runOnlyPendingTimersAsync();
  fetchMock.mockClear();
  return logger;
}

async function runNonRetryable4xxCase(): Promise<void> {
  const fetchMock = createFetchMock()
    .mockResolvedValueOnce(okResponse())
    .mockResolvedValueOnce(failedResponse(400))
    .mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.non_retryable_4xx");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expectCallCount(fetchMock, 1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2);
  expectCallCount(fetchMock, 1);
}

async function runRetryable5xxCase(): Promise<void> {
  const fetchMock = createFetchMock()
    .mockResolvedValueOnce(okResponse())
    .mockResolvedValueOnce(failedResponse(500))
    .mockResolvedValueOnce(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.retryable_5xx");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expectCallCount(fetchMock, 1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
  expectCallCount(fetchMock, 1);

  await vi.advanceTimersByTimeAsync(1);
  expectCallCount(fetchMock, 2);
}

async function runNetworkRetryCase(): Promise<void> {
  const fetchMock = createFetchMock()
    .mockResolvedValueOnce(okResponse())
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.network_error");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expectCallCount(fetchMock, 1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
  expectCallCount(fetchMock, 1);

  await vi.advanceTimersByTimeAsync(1);
  expectCallCount(fetchMock, 2);
}

async function importSentryMock(): Promise<SentryMockModule> {
  const sentryMock = await import("../../test/sentry-react-native.mock");
  return sentryMock;
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

async function runRedactionProofCase(): Promise<void> {
  const fetchMock = createFetchMock().mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.redaction.proof", {
    nested: {
      prompt: "do not leak this prompt",
      safe: "visible",
    },
    url: "conduit://pair#offer=secret",
  });
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);

  const [record] = readPostedRecords(fetchMock);
  expect(record).toMatchObject({
    event_name: "frontend.redaction.proof",
    nested: {
      prompt: "[redacted]",
      safe: "visible",
    },
    url: "[redacted]",
  });
}

async function runSentryInitializationCase(): Promise<void> {
  const fetchMock = createFetchMock().mockResolvedValue(okResponse());
  process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.sentry.breadcrumb", {
    endpoint_name: "settings/get",
  });
  const sentryMock = await importSentryMock();

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
  expect(sentryMock.logger.info).toHaveBeenCalledWith(
    "frontend.sentry.breadcrumb",
    expect.objectContaining({
      endpoint_name: "settings/get",
      event_name: "frontend.sentry.breadcrumb",
      log_profile: "stage",
    }),
  );
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
  expectCallCount(fetchMock, 1);
  const [record] = readPostedRecords(fetchMock);
  expectFailureRecord(record);
}

async function runSentryFailureCase(): Promise<void> {
  const fetchMock = createFetchMock().mockResolvedValue(okResponse());
  process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
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
  const fetchMock = createFetchMock().mockResolvedValue(okResponse());
  process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
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
  expectCallCount(fetchMock, 0);
}

describe("frontend logger retry policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(resetFrontendLoggerTestState);

  it("does not retry on non-retryable 4xx responses", runNonRetryable4xxCase);
  it("retries on retryable 5xx responses with backoff", runRetryable5xxCase);
  it("retries on network failures with backoff", runNetworkRetryCase);
  it(
    "redacts prompt and offer material before writing file logs",
    runRedactionProofCase,
  );
  it(
    "initializes Sentry from the same logger path when a DSN is configured",
    runSentryInitializationCase,
  );
  it(
    "captures failures as Sentry exceptions and keeps the file sink active",
    runSentryFailureCase,
  );
  it("enables Sentry in prod when a DSN is configured", runProdSentryDsnCase);
});
