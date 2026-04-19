import { useState } from "react";
import {
  forgetHost,
  pairHostFromOfferUrl,
  selectActiveHostProfile,
  selectHostProfiles,
  selectPairingError,
  useGetSettingsQuery,
} from "@/app-state";
import { Section } from "@/ui";
import { useDispatch, useSelector } from "react-redux";
import { connectionErrorMessage } from "./connection-error-message";
import { HostPairingList } from "./host-pairing-list";
import type { AppDispatch, RootState } from "@/app-state";
import type { ConnectionHostProfile } from "@conduit/app-client";
import type { HostPairingPanelProps } from "./host-pairing-types";

const relayPollingIntervalMs = 5000;

function connectionLabel(args: {
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
}): string {
  if (args.isSuccess) {
    return "Relay connected";
  }
  if (args.isFetching) {
    return "Relay connecting";
  }
  if (args.isError) {
    return "Relay reconnecting";
  }
  return "Relay idle";
}

function usePairingSelectors(): {
  activeHost: ConnectionHostProfile | null;
  hosts: ConnectionHostProfile[];
  pairingError: string | null;
} {
  const activeHost = useSelector((state: RootState) =>
    selectActiveHostProfile(state),
  );
  const hosts = useSelector((state: RootState) => selectHostProfiles(state));
  const pairingError = useSelector((state: RootState) =>
    selectPairingError(state),
  );
  return { activeHost, hosts, pairingError };
}

function HostPairingPanel({
  initialOfferUrl,
}: HostPairingPanelProps): React.JSX.Element {
  const [offerUrl, setOfferUrl] = useState(initialOfferUrl ?? "");
  const dispatch = useDispatch<AppDispatch>();
  const { activeHost, hosts, pairingError } = usePairingSelectors();
  const settings = useGetSettingsQuery(null, {
    pollingInterval: relayPollingIntervalMs,
    skip: activeHost === null,
  });

  function handleConnect(): void {
    pairHostFromOfferUrl({ dispatch, hosts, offerUrl });
    setOfferUrl("");
  }

  function handleForget(): void {
    if (activeHost !== null) {
      forgetHost({ dispatch, serverId: activeHost.serverId });
    }
  }

  return (
    <Section title="Desktop">
      <HostPairingList
        activeHost={activeHost}
        connectionError={connectionErrorMessage(settings.error)}
        connectionStatus={connectionLabel(settings)}
        offerUrl={offerUrl}
        onConnect={handleConnect}
        onForget={handleForget}
        onOfferUrlChange={setOfferUrl}
        pairingError={pairingError}
      />
    </Section>
  );
}

export { HostPairingPanel };
