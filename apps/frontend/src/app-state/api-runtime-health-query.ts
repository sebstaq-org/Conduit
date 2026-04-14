import { configuredSessionHealthUrl } from "./session-client";

interface RuntimeHealthView {
  checkedAt: string;
  service: string;
  transport: string;
}

type RuntimeHealthQueryResult = Promise<
  { data: RuntimeHealthView } | { error: string }
>;

function toQueryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "session request failed";
}

function runtimeHealthErrorMessage(status: number): string {
  return `runtime health failed (${status})`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return true;
}

function readRuntimeString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

function readRuntimeHealthPayload(payload: unknown): RuntimeHealthView | null {
  if (!isObjectRecord(payload)) {
    return null;
  }
  if (payload.ok !== true) {
    return null;
  }
  return {
    checkedAt: new Date().toISOString(),
    service: readRuntimeString(payload.service, "conduit-service"),
    transport: readRuntimeString(payload.transport, "websocket"),
  };
}

function createHealthTimeoutSignal(): {
  abortController: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 2000);
  return { abortController, timeoutId };
}

async function readRuntimeHealthResponse(
  signal: AbortSignal,
): Promise<RuntimeHealthView> {
  const response = await fetch(configuredSessionHealthUrl(), { signal });
  if (!response.ok) {
    throw new Error(runtimeHealthErrorMessage(response.status));
  }
  const payload = readRuntimeHealthPayload(await response.json());
  if (payload === null) {
    throw new Error("runtime health returned invalid payload");
  }
  return payload;
}

async function getRuntimeHealthQuery(): RuntimeHealthQueryResult {
  const timeoutSignal = createHealthTimeoutSignal();
  try {
    const data = await readRuntimeHealthResponse(
      timeoutSignal.abortController.signal,
    );
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  } finally {
    clearTimeout(timeoutSignal.timeoutId);
  }
}

export { getRuntimeHealthQuery };
export type { RuntimeHealthView };
