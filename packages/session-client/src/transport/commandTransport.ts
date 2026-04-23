import type {
  ConsumerCommand,
  ConsumerResponse,
} from "@conduit/session-contracts";

interface CommandTransport {
  close(): void;
  dispatch(command: ConsumerCommand): Promise<ConsumerResponse>;
}

export type { CommandTransport };
