import type {
  ProviderId,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
} from "./models";
import { logDebug, logInfo } from "./frontend-logger";
import {
  mapSessionHistoryWindow,
  mapSessionNewResult,
  mapSessionOpenResult,
} from "./protocol-adapters";
import { toQueryError } from "./session-api-query-utils";
import type { QueryResult } from "./session-api-query-utils";
import { sessionClient } from "./session-client";
import type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
} from "./session-api-session-query-types";

interface SessionQueryArgs {
  cwd: string;
  limit: number | undefined;
  provider: ProviderId;
}

interface OpenSessionQueryArgs extends SessionQueryArgs {
  session_id: string;
}

function appendFields(target: Record<string, unknown>, source: object): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = value;
  }
}

function mergedFields(base: object, extra: object): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  appendFields(merged, base);
  appendFields(merged, extra);
  return merged;
}

function startNewSessionQuery(queryArgs: SessionQueryArgs): SessionQueryArgs {
  logDebug("frontend.session.new.query.start", mergedFields(queryArgs, {}));
  return queryArgs;
}

function startOpenSessionQuery(
  queryArgs: OpenSessionQueryArgs,
): OpenSessionQueryArgs {
  logDebug("frontend.session.open.query.start", mergedFields(queryArgs, {}));
  return queryArgs;
}

function toQueryException(
  error: unknown,
  queryArgs: object,
  queryName: string,
): { error: string } {
  const queryFields = mergedFields(queryArgs, {});
  return {
    error: toQueryError(error, {
      query_args: queryFields,
      query_name: queryName,
    }),
  };
}

function toNewSessionSuccess(
  queryArgs: SessionQueryArgs,
  result: SessionNewResult,
): { data: SessionNewResult } {
  logInfo("frontend.session.new.query.success", {
    cwd: queryArgs.cwd,
    open_session_id: result.history.openSessionId,
    provider: queryArgs.provider,
    session_id: result.sessionId,
  });
  return { data: result };
}

function toOpenSessionSuccess(
  queryArgs: OpenSessionQueryArgs,
  result: SessionOpenResult,
): { data: SessionOpenResult } {
  logInfo(
    "frontend.session.open.query.success",
    mergedFields(queryArgs, {
      open_session_id: result.openSessionId,
      response_revision: result.revision,
      result_session_id: result.sessionId,
    }),
  );
  return { data: result };
}

async function newSessionQuery({
  cwd,
  limit,
  provider,
}: NewSessionMutationArg): QueryResult<SessionNewResult> {
  const queryArgs = startNewSessionQuery({ cwd, limit, provider });
  try {
    const result = mapSessionNewResult(
      await sessionClient.newSession(provider, { cwd, limit }),
    );
    return toNewSessionSuccess(queryArgs, result);
  } catch (error) {
    return toQueryException(error, queryArgs, "newSessionQuery");
  }
}

async function openSessionQuery({
  cwd,
  limit,
  provider,
  sessionId,
}: OpenSessionMutationArg): QueryResult<SessionOpenResult> {
  const queryArgs = startOpenSessionQuery({
    cwd,
    limit,
    provider,
    session_id: sessionId,
  });
  try {
    const result = mapSessionOpenResult(
      await sessionClient.openSession(provider, {
        cwd,
        limit,
        sessionId,
      }),
    );
    return toOpenSessionSuccess(queryArgs, result);
  } catch (error) {
    return toQueryException(error, queryArgs, "openSessionQuery");
  }
}

async function readSessionHistoryQuery({
  cursor,
  limit,
  openSessionId,
}: ReadSessionHistoryQueryArg): QueryResult<SessionHistoryWindow> {
  try {
    return {
      data: mapSessionHistoryWindow(
        await sessionClient.readSessionHistory({
          cursor,
          limit,
          openSessionId,
        }),
      ),
    };
  } catch (error) {
    return toQueryException(
      error,
      { cursor: cursor ?? null, limit, openSessionId },
      "readSessionHistoryQuery",
    );
  }
}

async function promptSessionQuery({
  openSessionId,
  prompt,
}: PromptSessionMutationArg): QueryResult<null> {
  try {
    await sessionClient.promptSession({ openSessionId, prompt });
    return { data: null };
  } catch (error) {
    return toQueryException(error, { openSessionId }, "promptSessionQuery");
  }
}

export {
  newSessionQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
};
