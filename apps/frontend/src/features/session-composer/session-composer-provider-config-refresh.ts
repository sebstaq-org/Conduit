import { skipToken } from "@reduxjs/toolkit/query";
import type { ProviderId } from "@conduit/session-client";
import {
  conduitApi,
  draftSessionProviderSelected,
  useReadSessionTimelineQuery,
} from "@/app-state";
import type { ActiveSession, AppDispatch } from "@/app-state";

const PROVIDER_CONFIG_DRAFT_POLLING_INTERVAL_MS = 1000;

function providerConfigPollingInterval(
  activeSession: ActiveSession | null,
): number {
  if (activeSession?.kind === "draft") {
    return PROVIDER_CONFIG_DRAFT_POLLING_INTERVAL_MS;
  }
  return 0;
}

function createHandleProviderSelect(
  dispatch: AppDispatch,
): (provider: ProviderId) => void {
  return (provider: ProviderId): void => {
    dispatch(draftSessionProviderSelected(provider));
    dispatch(
      conduitApi.util.invalidateTags([
        { id: "CURRENT", type: "ProviderConfigSnapshot" },
      ]),
    );
  };
}

function openSessionTimelineArg(
  activeSession: ActiveSession | null,
): typeof skipToken | { openSessionId: string } {
  if (activeSession?.kind !== "open") {
    return skipToken;
  }
  return { openSessionId: activeSession.openSessionId };
}

function useActiveSessionTimelineRevision(
  activeSession: ActiveSession | null,
): number | null {
  const { data } = useReadSessionTimelineQuery(
    openSessionTimelineArg(activeSession),
  );
  return data?.history.revision ?? null;
}

export {
  createHandleProviderSelect,
  providerConfigPollingInterval,
  useActiveSessionTimelineRevision,
};
