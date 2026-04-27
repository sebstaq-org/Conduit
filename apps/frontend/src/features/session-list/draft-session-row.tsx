import { Row } from "@/ui";
import { draftSessionLabel, draftSessionMeta } from "./draft-session";
import { draftSessionTarget } from "./session-list-target";
import { sessionRowDepth } from "./session-list.constants";
import type { ActiveSession } from "@/app-state";
import type { SessionListTargetSelected } from "./session-list-target";

interface DraftSessionRowProps {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  onSessionTargetSelected: SessionListTargetSelected;
}

function DraftSessionRow({
  activeSession,
  onSessionTargetSelected,
}: DraftSessionRowProps): React.JSX.Element {
  return (
    <Row
      depth={sessionRowDepth}
      label={draftSessionLabel}
      meta={draftSessionMeta(activeSession)}
      onPress={() => {
        onSessionTargetSelected(draftSessionTarget(activeSession.cwd));
      }}
      reserveLeadingSpace
      selected
    />
  );
}

export { DraftSessionRow };
