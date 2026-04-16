import { SessionGroupsViewSchema } from "@conduit/app-protocol";
import type {
  ConsumerResponse,
  SessionGroupsView,
} from "@conduit/app-protocol";

function readSessionGroupsResponse(
  response: ConsumerResponse,
): SessionGroupsView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? "session groups request failed");
  }
  return SessionGroupsViewSchema.parse(response.result);
}

export { readSessionGroupsResponse };
