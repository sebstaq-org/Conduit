import type { SessionSetConfigOptionResult } from "@conduit/session-client";
import type { SetSessionConfigOptionMutationArg } from "./session-api-queries";
import { setSessionConfigOptionQuery } from "./session-api-queries";
import { activeSessionConfigOptionsUpdated } from "./session-selection";

const setSessionConfigOptionEndpoint = {
  queryFn: setSessionConfigOptionQuery,
  async onQueryStarted(
    arg: SetSessionConfigOptionMutationArg,
    {
      dispatch,
      queryFulfilled,
    }: {
      dispatch: (action: unknown) => unknown;
      queryFulfilled: Promise<{ data: SessionSetConfigOptionResult }>;
    },
  ): Promise<void> {
    try {
      const { data } = await queryFulfilled;
      dispatch(
        activeSessionConfigOptionsUpdated({
          configOptions: data.configOptions,
          provider: arg.provider,
          sessionId: data.sessionId,
        }),
      );
    } catch {
      // The mutation result already carries the user-visible failure.
    }
  },
} as const;

export { setSessionConfigOptionEndpoint };
