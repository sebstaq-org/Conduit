import type {
  ProviderId,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
} from "@conduit/session-client";
import { logDebug, logInfo, logWarn } from "./frontend-logger";
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

interface RpcFailure {
  error: string;
}

interface ResponseWithError {
  error?: { code?: string | null; message?: string | null } | null;
  id?: string | number;
  ok: boolean;
  result: unknown;
}

interface NotOkContext {
  eventName: string;
  fallbackMessage: string;
  queryArgs: object;
  response: ResponseWithError;
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

function readResponseMessage(
  response: { error?: { message?: string | null } | null },
  fallback: string,
): string {
  const message = response.error?.message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }
  return fallback;
}

function buildTransportFields(
  queryArgs: object,
  response: ResponseWithError,
): Record<string, unknown> {
  return mergedFields(queryArgs, {
    response_error_code: response.error?.code ?? null,
    response_error_message: response.error?.message ?? null,
    response_id: response.id,
    response_ok: response.ok,
    response_result_present: response.result !== null,
  });
}

function rejectNotOk(context: NotOkContext): RpcFailure {
  const message = readResponseMessage(
    context.response,
    context.fallbackMessage,
  );
  logWarn(
    context.eventName,
    mergedFields(context.queryArgs, {
      rejection_code: "response_not_ok",
      rejection_message: message,
    }),
  );
  return { error: message };
}

function rejectMissingResult(
  eventName: string,
  queryArgs: object,
  message: string,
): RpcFailure {
  logWarn(
    eventName,
    mergedFields(queryArgs, { rejection_code: "response_result_missing" }),
  );
  return { error: message };
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
): RpcFailure {
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
    const response = await sessionClient.newSession(provider, { cwd, limit });
    logInfo(
      "frontend.session.new.query.transport",
      buildTransportFields(queryArgs, response),
    );
    if (!response.ok) {
      return rejectNotOk({
        eventName: "frontend.session.new.query.rejected",
        fallbackMessage: "session new failed",
        queryArgs,
        response,
      });
    }
    if (response.result === null) {
      return rejectMissingResult(
        "frontend.session.new.query.rejected",
        queryArgs,
        "session new returned no session",
      );
    }
    return toNewSessionSuccess(queryArgs, response.result);
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
    const response = await sessionClient.openSession(provider, {
      cwd,
      limit,
      sessionId,
    });
    logInfo(
      "frontend.session.open.query.transport",
      buildTransportFields(queryArgs, response),
    );
    if (!response.ok) {
      return rejectNotOk({
        eventName: "frontend.session.open.query.rejected",
        fallbackMessage: "session open failed",
        queryArgs,
        response,
      });
    }
    if (response.result === null) {
      return rejectMissingResult(
        "frontend.session.open.query.rejected",
        queryArgs,
        "session open returned no history",
      );
    }
    return toOpenSessionSuccess(queryArgs, response.result);
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
    const response = await sessionClient.readSessionHistory({
      cursor,
      limit,
      openSessionId,
    });
    if (!response.ok) {
      return { error: readResponseMessage(response, "session history failed") };
    }
    if (response.result === null) {
      return { error: "session history returned no window" };
    }
    return { data: response.result };
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
