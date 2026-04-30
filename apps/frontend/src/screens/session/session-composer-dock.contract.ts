import type {
  ActiveSession,
  SessionComposerPlanInteractionController,
} from "@/app-state";

function shouldRenderSessionComposerDock(
  activeSession: ActiveSession | null,
  planInteraction: SessionComposerPlanInteractionController,
): boolean {
  return activeSession !== null || planInteraction.view.activeCard !== null;
}

export { shouldRenderSessionComposerDock };
