import { skipToken } from "@reduxjs/toolkit/query";
import { useSelector } from "react-redux";
import { selectActiveSession, useReadSessionHistoryQuery } from "@/app-state";
import { Box, Text } from "@/theme";
import { ScrollArea } from "@/ui";
import { historyStatusVariant } from "./session-history.styles";
import { SessionHistoryList } from "./session-history-list";
import type { ProviderId } from "@conduit/session-client";

type SessionHistoryQueryArg =
  | {
      openSessionId: string;
      provider: ProviderId;
    }
  | typeof skipToken;

function sessionHistoryQueryArg(
  activeSession: ReturnType<typeof selectActiveSession>,
): SessionHistoryQueryArg {
  if (activeSession === null) {
    return skipToken;
  }
  return {
    openSessionId: activeSession.openSessionId,
    provider: activeSession.provider,
  };
}

function SessionHistory(): React.JSX.Element {
  const activeSession = useSelector(selectActiveSession);
  const { data, isError, isFetching, isLoading } = useReadSessionHistoryQuery(
    sessionHistoryQueryArg(activeSession),
  );

  if (activeSession === null) {
    return (
      <Box flex={1}>
        <Text variant={historyStatusVariant}>Select a session</Text>
      </Box>
    );
  }

  return (
    <Box flex={1}>
      <ScrollArea>
        <SessionHistoryList
          history={data}
          isError={isError}
          isFetching={isFetching}
          isLoading={isLoading}
          title={activeSession.title ?? activeSession.cwd}
        />
      </ScrollArea>
    </Box>
  );
}

export { SessionHistory };
