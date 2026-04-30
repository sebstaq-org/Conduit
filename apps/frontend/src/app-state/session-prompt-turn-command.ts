import type { PromptSessionMutationArg } from "./api";
import { SESSION_PROMPT_CANCEL_AFTER_MS } from "./session-api-session-query-types";
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
      cancelAfterMs: SESSION_PROMPT_CANCEL_AFTER_MS,
      openSessionId,
      prompt: [{ text, type: "text" }],
    }).unwrap();
  } finally {
    onPromptTurnFinished?.(identity);
  }
}

export { promptTrackedOpenSession };
export type { PromptSessionTrigger };
