import type { FrontendLogRecord } from "./frontend-logger-types";

const REQUEST_TIMEOUT_MS = 3000;

interface ClientLogIngestErrorOptions {
  cause?: unknown;
  retryable: boolean;
  status: number | null;
}

class ClientLogIngestError extends Error {
  public readonly retryable: boolean;
  public readonly status: number | null;

  public constructor(message: string, options: ClientLogIngestErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "ClientLogIngestError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

function isRetryableStatusCode(status: number): boolean {
  if (status === 429) {
    return true;
  }
  return status >= 500;
}

function requestOptions(
  records: FrontendLogRecord[],
  signal: AbortSignal,
): RequestInit {
  return {
    body: JSON.stringify({ records }),
    headers: { "content-type": "application/json" },
    keepalive: records.length <= 10,
    method: "POST",
    signal,
  };
}

async function postRecordsWithTimeout(
  records: FrontendLogRecord[],
  sinkUrl: string,
): Promise<Response> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await fetch(
      sinkUrl,
      requestOptions(records, abortController.signal),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertSuccessfulResponse(response: Response): void {
  if (response.ok) {
    return;
  }
  throw new ClientLogIngestError(
    `client log ingestion failed (${response.status})`,
    {
      retryable: isRetryableStatusCode(response.status),
      status: response.status,
    },
  );
}

async function postRecords(
  records: FrontendLogRecord[],
  sinkUrl: string,
): Promise<void> {
  try {
    const response = await postRecordsWithTimeout(records, sinkUrl);
    assertSuccessfulResponse(response);
  } catch (error) {
    if (error instanceof ClientLogIngestError) {
      throw error;
    }
    throw new ClientLogIngestError(
      "client log ingestion failed (network error)",
      {
        cause: error,
        retryable: true,
        status: null,
      },
    );
  }
}

function shouldRetryIngest(error: unknown): boolean {
  if (error instanceof ClientLogIngestError) {
    return error.retryable;
  }
  return true;
}

export { postRecords, shouldRetryIngest };
