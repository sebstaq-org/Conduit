import type {
  OpenSessionMutationArg,
  useOpenSessionMutation,
  usePromptSessionMutation,
} from "./api";
import type { ActiveSession } from "./session-selection";

type OpenSessionTrigger = ReturnType<typeof useOpenSessionMutation>[0];
type PromptSessionTrigger = ReturnType<typeof usePromptSessionMutation>[0];

interface OpenSessionRowArgs {
  openSession: OpenSessionTrigger;
  request: OpenSessionMutationArg;
  onSessionSelected?: (() => void) | undefined;
}

interface SubmitPromptArgs {
  activeSession: ActiveSession;
  promptSession: PromptSessionTrigger;
  setDraft: (draft: string) => void;
  text: string;
}

function canSubmitPrompt(
  activeSession: ActiveSession | null,
  isLoading: boolean,
  text: string,
): boolean {
  return activeSession !== null && !isLoading && text.length > 0;
}

async function openSessionRow({
  onSessionSelected,
  openSession,
  request,
}: OpenSessionRowArgs): Promise<void> {
  try {
    await openSession(request).unwrap();
    onSessionSelected?.();
  } catch {
    // The mutation state renders the failure row.
  }
}

async function submitPrompt({
  activeSession,
  promptSession,
  setDraft,
  text,
}: SubmitPromptArgs): Promise<void> {
  try {
    await promptSession({
      openSessionId: activeSession.openSessionId,
      prompt: [{ text, type: "text" }],
      provider: activeSession.provider,
    }).unwrap();
    setDraft("");
  } catch {
    // The mutation state renders the failure while preserving the draft.
  }
}

export { canSubmitPrompt, openSessionRow, submitPrompt };
