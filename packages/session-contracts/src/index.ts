import type { ProviderId, ProviderSnapshot } from "@conduit/session-model";

let nextCommandSequence = 0;

export const SESSION_COMMANDS = [
  "initialize",
  "session/new",
  "session/list",
  "session/load",
  "session/prompt",
  "session/cancel",
] as const;

export const CONDUIT_COMMANDS = [
  "provider/snapshot",
  "provider/disconnect",
  "events/subscribe",
] as const;

export const CONSUMER_COMMANDS = [
  ...SESSION_COMMANDS,
  ...CONDUIT_COMMANDS,
] as const;

export type SessionCommandName = (typeof SESSION_COMMANDS)[number];

export type ConduitCommandName = (typeof CONDUIT_COMMANDS)[number];

export type ConsumerCommandName = (typeof CONSUMER_COMMANDS)[number];

export interface ConsumerCommand {
  id: string;
  command: ConsumerCommandName;
  provider: ProviderId;
  params: Record<string, unknown>;
}

export interface ConsumerError {
  code: string;
  message: string;
}

export interface ConsumerResponse<Result = unknown> {
  id: string;
  ok: boolean;
  result: Result;
  error: ConsumerError | null;
  snapshot: ProviderSnapshot | null;
}

export function createConsumerCommand(
  command: ConsumerCommandName,
  provider: ProviderId,
  params: Record<string, unknown> = {},
  id = nextConsumerCommandId(),
): ConsumerCommand {
  return {
    id,
    command,
    provider,
    params,
  };
}

function nextConsumerCommandId(): string {
  nextCommandSequence += 1;
  return `conduit-command-${String(nextCommandSequence)}`;
}
