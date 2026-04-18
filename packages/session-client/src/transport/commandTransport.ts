import type {
  ConsumerCommand,
  ConsumerResponse,
} from "@conduit/session-contracts";

interface CommandTransport {
  dispatch(command: ConsumerCommand): Promise<ConsumerResponse>;
}

export type { CommandTransport };
