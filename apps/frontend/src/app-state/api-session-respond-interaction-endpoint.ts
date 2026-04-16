import type { SessionRespondInteractionRequest } from "@conduit/session-contracts";
import { sessionClient } from "./session-api-queries";

type RespondInteractionMutationArg = SessionRespondInteractionRequest;

interface SessionTimelineTag {
  id: string;
  type: "SessionTimeline";
}

type QueryResult<ResponseData> = Promise<
  { data: ResponseData } | { error: string }
>;

function toQueryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "session respond_interaction failed";
}

async function respondInteractionQuery(
  request: RespondInteractionMutationArg,
): QueryResult<null> {
  try {
    await sessionClient.respondInteraction(request);
    return { data: null };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

function respondInteractionInvalidatesTags(
  _result: null | undefined,
  _error: unknown,
  { openSessionId }: RespondInteractionMutationArg,
): SessionTimelineTag[] {
  return [{ id: openSessionId, type: "SessionTimeline" }];
}

const respondInteractionEndpoint = {
  invalidatesTags: respondInteractionInvalidatesTags,
  queryFn: respondInteractionQuery,
} as const;

export { respondInteractionEndpoint };
export type { RespondInteractionMutationArg };
