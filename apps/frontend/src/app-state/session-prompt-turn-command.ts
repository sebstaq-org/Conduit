import type { PromptSessionMutationArg } from "./api";
import type { SessionPromptTurnIdentity } from "./session-prompt-turns";

interface PromptSessionResult {
  unwrap: () => Promise<unknown>;
}

type PromptSessionTrigger = (
  request: PromptSessionMutationArg,
) => PromptSessionResult;

interface PromptTrackedOpenSessionArgs {
  identity: SessionPromptTurnIdentity;
  onPromptTurnFinished?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  onPromptTurnStarted?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  openSessionId: string;
  promptSession: PromptSessionTrigger;
  text: string;
}

async function promptTrackedOpenSession({
  identity,
  onPromptTurnFinished,
  onPromptTurnStarted,
  openSessionId,
  promptSession,
  text,
}: PromptTrackedOpenSessionArgs): Promise<void> {
  onPromptTurnStarted?.(identity);
  try {
    await promptSession({
      openSessionId,
      prompt: [{ text, type: "text" }],
    }).unwrap();
  } finally {
    onPromptTurnFinished?.(identity);
  }
}

export { promptTrackedOpenSession };
