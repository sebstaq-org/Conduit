import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { createSessionClient } from "@conduit/session-client";
import type {
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-client";

const sessionClient = createSessionClient();

function toQueryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "session groups request failed";
}

const conduitApi = createApi({
  reducerPath: "conduitApi",
  baseQuery: fakeBaseQuery<string>(),
  endpoints: (builder) => ({
    getSessionGroups: builder.query<
      SessionGroupsView,
      SessionGroupsQuery | undefined
    >({
      queryFn: async (query) => {
        try {
          const data = await sessionClient.getSessionGroups(query);
          return { data };
        } catch (error) {
          return { error: toQueryError(error) };
        }
      },
    }),
  }),
});

const { useGetSessionGroupsQuery } = conduitApi;

export { conduitApi, useGetSessionGroupsQuery };
