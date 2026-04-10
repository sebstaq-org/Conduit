import type {
  DesktopAction,
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/app-core";

export type {
  DesktopAction,
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/app-core";

export interface DesktopProofRequest {
  provider: ProviderId;
  action: DesktopAction;
  cwd: string;
  prompt?: string;
  cancelAfterMs?: number;
}

export interface DesktopProofResult {
  provider: ProviderId;
  action: DesktopAction;
  artifactRoot: string;
  snapshot: ProviderSnapshot;
  requests: unknown[];
  responses: unknown[];
  events: RawWireEvent[];
  summary: string;
  lastSessionId: string | null;
}

export interface AppClientPort {
  readonly policy: "official-acp-only";
  runAction(request: DesktopProofRequest): Promise<DesktopProofResult>;
  getProviderSnapshot(provider: ProviderId): Promise<DesktopProofResult>;
}

interface FetchOptions {
  baseUrl?: string;
}

export class DesktopProofClient implements AppClientPort {
  public readonly policy = "official-acp-only";

  public constructor(private readonly options: FetchOptions = {}) {}

  public runAction(request: DesktopProofRequest): Promise<DesktopProofResult> {
    return this.post("/api/run", request);
  }

  public getProviderSnapshot(
    provider: ProviderId,
  ): Promise<DesktopProofResult> {
    return this.runAction({
      provider,
      action: "connect",
      cwd: process.cwd(),
    });
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
    return (await response.json()) as DesktopProofResult;
  }

  private baseUrl(): string {
    return this.options.baseUrl ?? "http://127.0.0.1:4173";
  }
}

export function createDesktopProofClient(
  options?: FetchOptions,
): AppClientPort {
  return new DesktopProofClient(options);
}
