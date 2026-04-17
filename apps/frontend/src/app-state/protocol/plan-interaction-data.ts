import {
  ConduitInteractionRequestDataSchema,
  ConduitInteractionResolutionDataSchema,
  ConduitTerminalPlanDataSchema,
} from "@conduit/app-protocol";
import type {
  ConduitInteractionOption,
  ConduitInteractionRequestData,
  ConduitInteractionResolutionData,
  ConduitTerminalPlanData,
} from "@conduit/app-protocol";
import type { TranscriptItem } from "@conduit/session-client";

type BackendInteractionOption = ConduitInteractionOption;
type BackendInteractionRequestData = ConduitInteractionRequestData;
type BackendInteractionResolutionData = ConduitInteractionResolutionData;
type BackendTerminalPlanData = ConduitTerminalPlanData;

function interactionRequestData(
  item: TranscriptItem,
): BackendInteractionRequestData | null {
  if (item.kind !== "event" || item.variant !== "interaction_request") {
    return null;
  }
  const parsed = ConduitInteractionRequestDataSchema.safeParse(item.data);
  if (parsed.success) {
    return parsed.data;
  }
  return null;
}

function interactionResolutionData(
  item: TranscriptItem,
): BackendInteractionResolutionData | null {
  if (item.kind !== "event" || item.variant !== "interaction_resolution") {
    return null;
  }
  const parsed = ConduitInteractionResolutionDataSchema.safeParse(item.data);
  if (parsed.success) {
    return parsed.data;
  }
  return null;
}

function terminalPlanData(
  item: TranscriptItem,
): BackendTerminalPlanData | null {
  if (item.kind !== "event" || item.variant !== "terminal_plan") {
    return null;
  }
  const parsed = ConduitTerminalPlanDataSchema.safeParse(item.data);
  if (parsed.success) {
    return parsed.data;
  }
  return null;
}

export { interactionRequestData, interactionResolutionData, terminalPlanData };
export type {
  BackendInteractionOption,
  BackendInteractionRequestData,
  BackendInteractionResolutionData,
  BackendTerminalPlanData,
};
