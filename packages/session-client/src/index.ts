import type {
  ConsumerCommand,
  ConsumerResponse,
} from "@conduit/session-contracts";
import { createConsumerCommand } from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

export * from "@conduit/session-contracts";
export * from "@conduit/session-model";

export interface SessionClientPort {
  readonly policy: "official-acp-only";
  dispatch(command: ConsumerCommand): Promise<ConsumerResponse>;
  initialize(provider: ProviderId): Promise<ConsumerResponse>;
}

export interface SessionClientOptions {
  baseUrl?: string;
  path?: string;
  fetchImpl?: typeof fetch;
}

export class HttpSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";

  public constructor(private readonly options: SessionClientOptions = {}) {}

  public dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    return this.post(command);
  }

  public initialize(provider: ProviderId): Promise<ConsumerResponse> {
    return this.dispatch(createConsumerCommand("initialize", provider));
  }

  private async post(command: ConsumerCommand): Promise<ConsumerResponse> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(`${this.baseUrl()}${this.path()}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      throw new Error(`session command failed: ${String(response.status)}`);
    }
    return (await response.json()) as ConsumerResponse;
  }

  private baseUrl(): string {
    return this.options.baseUrl ?? "http://127.0.0.1:4173";
  }

  private path(): string {
    return this.options.path ?? "/api/session";
  }
}

export function createSessionClient(
  options?: SessionClientOptions,
): SessionClientPort {
  return new HttpSessionClient(options);
}
