import {
  isProjectCommandName,
  projectCommandFactories,
} from "./projectCommandFactories.js";
import { conduitFactories } from "./createConsumerCommandFactories.js";
import type {
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  GlobalCommandTarget,
} from "./wire.js";
import type { ProjectCommandName } from "./projectCommandFactories.js";
import type { NonProjectConduitCommandName } from "./createConsumerCommandFactories.js";
import { ConsumerCommandSchema } from "./wire.js";

let nextCommandSequence = 0;

function nextConsumerCommandId(): string {
  nextCommandSequence += 1;
  return `conduit-command-${String(nextCommandSequence)}`;
}

function requireGlobalProvider(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
): GlobalCommandTarget {
  if (provider !== "all") {
    throw new Error(`${command} must target provider "all"`);
  }
  return provider;
}

function requireProvider(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
): ConsumerCommandTarget {
  if (provider === "all") {
    throw new Error(`${command} must target a provider`);
  }
  return provider;
}

function parseConsumerCommand(command: unknown): ConsumerCommand {
  return ConsumerCommandSchema.parse(command);
}

function isKnownConduitCommandName(
  command: ConsumerCommandName,
): command is ProjectCommandName | NonProjectConduitCommandName {
  return isProjectCommandName(command) || command in conduitFactories;
}

function createConsumerCommand(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
  params: Record<string, unknown> = {},
): ConsumerCommand {
  const id = nextConsumerCommandId();
  if (isKnownConduitCommandName(command)) {
    if (isProjectCommandName(command)) {
      const globalProvider = requireGlobalProvider(command, provider);
      return parseConsumerCommand(
        projectCommandFactories[command](id, globalProvider, params),
      );
    }
    return parseConsumerCommand(
      conduitFactories[command](id, provider, params),
    );
  }
  return parseConsumerCommand({
    id,
    command,
    provider: requireProvider(command, provider),
    params: Object.fromEntries(Object.entries(params)),
  });
}

export { createConsumerCommand };
