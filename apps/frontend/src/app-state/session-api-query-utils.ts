import { logFailure } from "./frontend-logger";

type QueryResult<ResponseData> = Promise<
  { data: ResponseData } | { error: string }
>;

interface QueryErrorContext extends Record<string, unknown> {
  query_name: string;
  query_args?: Record<string, unknown>;
}

function toQueryError(error: unknown, context: QueryErrorContext): string {
  logFailure("frontend.api.query.exception", error, context);
  if (error instanceof Error) {
    return error.message;
  }
  return "session request failed";
}

export { toQueryError };
export type { QueryResult };
