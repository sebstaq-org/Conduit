import { SessionGroupsViewSchema } from "@conduit/session-model";
import type {
  ConsumerResponse,
  SessionGroupsView,
} from "@conduit/session-contracts";

function readSessionGroupsResponse(
  response: ConsumerResponse,
): SessionGroupsView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? "session groups request failed");
  }
  return SessionGroupsViewSchema.parse(response.result);
}

export { readSessionGroupsResponse };
