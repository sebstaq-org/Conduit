import { PROVIDERS } from "@conduit/app-protocol";
import type {
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/app-protocol";

const DESKTOP_PROOF_ACTIONS = [
  "connect",
  "new",
  "list",
  "load",
  "prompt",
  "cancel",
] as const;

type DesktopProofAction = (typeof DESKTOP_PROOF_ACTIONS)[number];

interface DesktopProofRequest {
  provider: ProviderId;
  action: DesktopProofAction;
  cwd: string;
  prompt?: string;
  cancelAfterMs?: number;
}

interface DesktopProofConfig {
  providers: ProviderId[];
  actions: DesktopProofAction[];
  defaultCwd: string;
  copy: {
    title: string;
    subtitle: string;
    promptPlaceholder: string;
  };
}

interface DesktopProofResult {
  provider: ProviderId;
  action: DesktopProofAction;
  artifactRoot: string;
  desktopProofPng: string;
  snapshot: ProviderSnapshot;
  requests: unknown[];
  responses: unknown[];
  events: RawWireEvent[];
  summary: string;
  lastSessionId: string | null;
}

interface AppClientPort {
  readonly policy: "official-acp-only";
  runAction(request: DesktopProofRequest): Promise<DesktopProofResult>;
  getProviderSnapshot(provider: ProviderId): Promise<DesktopProofResult>;
}

interface FetchOptions {
  baseUrl?: string;
}

function isDesktopProofResult(value: unknown): value is DesktopProofResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "provider" in value &&
    "action" in value &&
    "snapshot" in value
  );
}

function readDesktopProofResult(value: unknown): DesktopProofResult {
  if (!isDesktopProofResult(value)) {
    throw new Error("desktop proof response shape is invalid");
  }
  return value;
}

class DesktopProofClient implements AppClientPort {
  public readonly policy = "official-acp-only";
  private readonly options: FetchOptions;

  public constructor(options: FetchOptions = {}) {
    this.options = options;
  }

  public async runAction(
    request: DesktopProofRequest,
  ): Promise<DesktopProofResult> {
    const response = await this.post("/api/run", request);
    return response;
  }

  public async getProviderSnapshot(
    provider: ProviderId,
  ): Promise<DesktopProofResult> {
    const response = await this.runAction({
      provider,
      action: "connect",
      cwd: process.cwd(),
    });
    return response;
  }

  private async post(
    path: string,
    request: DesktopProofRequest,
  ): Promise<DesktopProofResult> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(
        `desktop proof request failed: ${String(response.status)}`,
      );
    }
    return readDesktopProofResult(await response.json());
  }

  private baseUrl(): string {
    return this.options.baseUrl ?? "http://127.0.0.1:4173";
  }
}

function createDesktopProofClient(options?: FetchOptions): AppClientPort {
  return new DesktopProofClient(options);
}

export {
  DESKTOP_PROOF_ACTIONS,
  DesktopProofClient,
  PROVIDERS,
  createDesktopProofClient,
};
export type {
  AppClientPort,
  DesktopProofAction,
  DesktopProofConfig,
  DesktopProofRequest,
  DesktopProofResult,
  FetchOptions,
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
};
