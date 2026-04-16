import {
  ConsumerCommandSchema,
  type ConsumerCommand,
} from "@conduit/app-protocol";

type ConsumerCommandName = ConsumerCommand["command"];
type CommandFor<Name extends ConsumerCommandName> = Extract<
  ConsumerCommand,
  { command: Name }
>;

let nextCommandSequence = 0;

function nextConsumerCommandId(): string {
  nextCommandSequence += 1;
  return `conduit-command-${String(nextCommandSequence)}`;
}

function hasCommandName<Name extends ConsumerCommandName>(
  command: Name,
  value: ConsumerCommand,
): value is CommandFor<Name> {
  return value.command === command;
}

function createConsumerCommand<Name extends ConsumerCommandName>(
  command: Name,
  provider: CommandFor<Name>["provider"],
  params: CommandFor<Name>["params"],
): CommandFor<Name> {
  const parsed = ConsumerCommandSchema.parse({
    id: nextConsumerCommandId(),
    command,
    provider,
    params,
  });
  if (!hasCommandName(command, parsed)) {
    throw new Error(`Generated consumer command drifted for ${command}`);
  }
  return parsed;
}

export { createConsumerCommand };
export type { ConsumerCommandName, CommandFor };
