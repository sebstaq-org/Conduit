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

function fetchMockWithResponses(
  ...responses: readonly (Error | Response)[]
): FetchMock {
  const fetchMock = vi.fn<FetchFunction>();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchMock.mockRejectedValueOnce(response);
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }
  return fetchMock;
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
  vi.stubGlobal("navigator", { product: "ReactNative" });
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
  const fetchMock = fetchMockWithResponses(okResponse(), failedResponse(400));
  fetchMock.mockResolvedValue(okResponse());
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.non_retryable_4xx");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expect(fetchMock.mock.calls).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2);
  expect(fetchMock.mock.calls).toHaveLength(1);
}

async function runRetryable5xxCase(): Promise<void> {
  const fetchMock = fetchMockWithResponses(
    okResponse(),
    failedResponse(500),
    okResponse(),
  );
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.retryable_5xx");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expect(fetchMock.mock.calls).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
  expect(fetchMock.mock.calls).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock.mock.calls).toHaveLength(2);
}

async function runNetworkRetryCase(): Promise<void> {
  const fetchMock = fetchMockWithResponses(
    okResponse(),
    new Error("network down"),
    okResponse(),
  );
  const logger = await setupLogger(fetchMock);

  logger.logInfo("frontend.retry_policy.network_error");
  await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
  expect(fetchMock.mock.calls).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
  expect(fetchMock.mock.calls).toHaveLength(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock.mock.calls).toHaveLength(2);
}

async function resetFrontendLoggerTestState(): Promise<void> {
  delete process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE;
  delete process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  delete process.env.EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL;
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  const sentryMock = await import("../../test/sentry-react-native.mock");
  sentryMock.resetSentryMock();
  vi.useRealTimers();
  vi.unstubAllGlobals();
}

async function runRedactionProofCase(): Promise<void> {
  const fetchMock = vi.fn<FetchFunction>().mockResolvedValue(okResponse());
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
});
