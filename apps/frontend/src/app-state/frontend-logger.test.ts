import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FLUSH_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 2000;

type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type FetchMock = ReturnType<typeof vi.fn<FetchFunction>>;
interface FrontendLoggerModule {
  initializeFrontendLogging: () => void;
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

async function setupLogger(
  fetchMock: FetchMock,
): Promise<FrontendLoggerModule> {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE = "stage";
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

describe("frontend logger retry policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE;
    delete process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
    delete process.env.EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not retry on non-retryable 4xx responses", runNonRetryable4xxCase);
  it("retries on retryable 5xx responses with backoff", runRetryable5xxCase);
  it("retries on network failures with backoff", runNetworkRetryCase);
});
