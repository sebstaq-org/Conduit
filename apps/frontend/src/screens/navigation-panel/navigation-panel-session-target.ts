import { draftSessionStarted } from "@/app-state/session-selection";
import type {
  OpenSessionTarget,
  SessionListTarget,
} from "@/features/session-list/session-list-target";

type SessionTargetDispatch = (
  action: ReturnType<typeof draftSessionStarted>,
) => void;

interface SelectNavigationPanelSessionTargetArgs {
  dispatch: SessionTargetDispatch;
  onOpenSessionTarget: (target: OpenSessionTarget) => void;
  onSessionTargetSelected?: ((target: SessionListTarget) => void) | undefined;
  target: SessionListTarget;
}

function selectNavigationPanelSessionTarget({
  dispatch,
  onOpenSessionTarget,
  onSessionTargetSelected,
  target,
}: SelectNavigationPanelSessionTargetArgs): void {
  onSessionTargetSelected?.(target);
  if (target.kind === "draft") {
    dispatch(draftSessionStarted({ cwd: target.cwd }));
  } else {
    onOpenSessionTarget(target);
  }
}

export { selectNavigationPanelSessionTarget };
export type { SelectNavigationPanelSessionTargetArgs };
