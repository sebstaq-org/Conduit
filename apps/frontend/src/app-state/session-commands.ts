import type { NewSessionMutationArg, OpenSessionMutationArg } from "./api";
import type {
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
} from "./api-hooks";
import type { ActiveSession } from "./session-selection";

const NEW_SESSION_HISTORY_LIMIT = 100;

type NewSessionTrigger = ReturnType<typeof useNewSessionMutation>[0];
type OpenSessionTrigger = ReturnType<typeof useOpenSessionMutation>[0];
type PromptSessionTrigger = ReturnType<typeof usePromptSessionMutation>[0];

interface OpenSessionRowArgs {
  openSession: OpenSessionTrigger;
  request: OpenSessionMutationArg;
  onSessionSelected?: (() => void) | undefined;
}

interface SubmitPromptArgs {
  activeSession: ActiveSession;
  newSession: NewSessionTrigger;
  promptSession: PromptSessionTrigger;
  setDraft: (draft: string) => void;
  text: string;
}

function canSubmitPrompt(
  activeSession: ActiveSession | null,
  isLoading: boolean,
  text: string,
): boolean {
  if (activeSession === null || isLoading || text.length === 0) {
    return false;
  }
  if (activeSession.kind === "draft") {
    return activeSession.provider !== null;
  }
  return true;
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
  newSession,
  promptSession,
  setDraft,
  text,
}: SubmitPromptArgs): Promise<void> {
  try {
    if (activeSession.kind === "draft") {
      if (activeSession.provider === null) {
        return;
      }
      const created = await newSession({
        cwd: activeSession.cwd,
        limit: NEW_SESSION_HISTORY_LIMIT,
        provider: activeSession.provider,
      } satisfies NewSessionMutationArg).unwrap();
      await promptSession({
        openSessionId: created.history.openSessionId,
        prompt: [{ text, type: "text" }],
      }).unwrap();
      setDraft("");
      return;
    }
    await promptSession({
      openSessionId: activeSession.openSessionId,
      prompt: [{ text, type: "text" }],
    }).unwrap();
    setDraft("");
  } catch {
    // The mutation state renders the failure while preserving the draft.
  }
}

export { canSubmitPrompt, openSessionRow, submitPrompt };
