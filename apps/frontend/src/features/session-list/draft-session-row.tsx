import { Row } from "@/ui";
import { draftSessionLabel, draftSessionMeta } from "./draft-session";
import { sessionRowDepth } from "./session-list.constants";
import type { ActiveSession } from "@/app-state";

interface DraftSessionRowProps {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
}

function DraftSessionRow({
  activeSession,
}: DraftSessionRowProps): React.JSX.Element {
  return (
    <Row
      depth={sessionRowDepth}
      label={draftSessionLabel}
      meta={draftSessionMeta(activeSession)}
      selected
    />
  );
}

export { DraftSessionRow };
