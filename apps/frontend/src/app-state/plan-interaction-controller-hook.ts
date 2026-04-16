import { useState } from "react";
import { createPlanInteractionActions } from "./plan-interaction-actions";
import {
  activeCardFor,
  createInitialLocalState,
  createView,
  selectOptionAction,
  setOtherTextAction,
} from "./plan-interaction-controller";
import type {
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionController,
} from "./plan-interaction-types";

function usePlanInteractionController(
  port: PlanInteractionRuntimePort,
): SessionComposerPlanInteractionController {
  const [state, setState] = useState(createInitialLocalState);
  const card = activeCardFor(port);
  return {
    actions: createPlanInteractionActions({
      card,
      port,
      selectOption: (optionId): void => {
        selectOptionAction({ card, optionId, setState });
      },
      setOtherText: (text): void => {
        setOtherTextAction({ card, setState, text });
      },
      setState,
      state,
    }),
    history: port.history,
    view: createView({ card, port, state }),
  };
}

export { usePlanInteractionController };
