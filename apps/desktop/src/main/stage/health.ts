import { get } from "node:http";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { StageRuntimeConfig } from "./types.js";

const healthAttempts = 60;
const healthRetryMs = 500;
const requestTimeoutMs = 2000;

interface BackendHealthSource {
  readonly running: boolean;
}

interface HealthPollRequest {
  readonly attempt: number;
  readonly label: string;
  readonly lastError: string;
  readonly onFailure: (error: Error) => void;
  readonly onSuccess: () => void;
  readonly shouldContinue: () => boolean;
  readonly url: string;
}

interface BackendHealthRequest {
  readonly backend: BackendHealthSource;
  readonly config: StageRuntimeConfig;
  readonly onFailure: (error: Error) => void;
  readonly onSuccess: () => void;
}

interface WebHealthRequest {
  readonly config: StageRuntimeConfig;
  readonly onFailure: (error: Error) => void;
  readonly onSuccess: () => void;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return true;
}

function readHealthErrorMessage(payload: unknown): string | null {
  if (!isObjectRecord(payload)) {
    return null;
  }
  const message = payload.error_message;
  if (typeof message !== "string" || message.length === 0) {
    return null;
  }
  return message;
}

function parseHealthErrorMessage(payload: string): string | null {
  try {
    return readHealthErrorMessage(JSON.parse(payload) as unknown);
  } catch {
    return null;
  }
}

function responseIsOk(response: IncomingMessage): boolean {
  const statusCode = response.statusCode ?? 0;
  return statusCode >= 200 && statusCode < 300;
}

function bindRequestTimeout(request: ClientRequest): void {
  request.setTimeout(requestTimeoutMs, () => {
    request.destroy(new Error("health request timed out"));
  });
}

class HealthPoller {
  readonly #request: HealthPollRequest;

  constructor(request: HealthPollRequest) {
    this.#request = request;
  }

  start(): void {
    this.#poll(this.#request);
  }

  #poll(request: HealthPollRequest): void {
    if (!request.shouldContinue()) {
      request.onFailure(
        new Error(`${request.label} exited before health check.`),
      );
      return;
    }
    if (request.attempt >= healthAttempts) {
      request.onFailure(
        new Error(
          `${request.label} did not become healthy: ${request.lastError}`,
        ),
      );
      return;
    }
    const httpRequest = get(request.url, (response) => {
      this.#handleResponse(request, response);
    });
    bindRequestTimeout(httpRequest);
    httpRequest.once("error", (error) => {
      this.#scheduleNext(request, error.message);
    });
  }

  #handleResponse(request: HealthPollRequest, response: IncomingMessage): void {
    const chunks: Uint8Array[] = [];
    response.on("data", (chunk: Uint8Array | string) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
        return;
      }
      chunks.push(chunk);
    });
    response.once("end", () => {
      if (responseIsOk(response)) {
        request.onSuccess();
        return;
      }
      let message: string | null = null;
      if (chunks.length > 0) {
        const payload = Buffer.concat(chunks).toString("utf8");
        message = parseHealthErrorMessage(payload);
      }
      this.#scheduleNext(
        request,
        message ?? `health returned HTTP ${String(response.statusCode ?? 0)}`,
      );
    });
  }

  #scheduleNext(request: HealthPollRequest, lastError: string): void {
    setTimeout(() => {
      this.#poll({
        attempt: request.attempt + 1,
        label: request.label,
        lastError,
        onFailure: request.onFailure,
        onSuccess: request.onSuccess,
        shouldContinue: request.shouldContinue,
        url: request.url,
      });
    }, healthRetryMs);
  }
}

function waitForBackendHealth(request: BackendHealthRequest): void {
  new HealthPoller({
    attempt: 0,
    label: "backend",
    lastError: "backend health was not checked",
    onFailure: request.onFailure,
    onSuccess: request.onSuccess,
    shouldContinue: (): boolean => request.backend.running,
    url: `http://${request.config.backendHost}:${String(request.config.backendPort)}/health`,
  }).start();
}

function waitForWebHealth(request: WebHealthRequest): void {
  new HealthPoller({
    attempt: 0,
    label: "stage web",
    lastError: "web health was not checked",
    onFailure: request.onFailure,
    onSuccess: request.onSuccess,
    shouldContinue: (): boolean => true,
    url: `http://${request.config.webHost}:${String(request.config.webPort)}/`,
  }).start();
}

export { waitForBackendHealth, waitForWebHealth };
