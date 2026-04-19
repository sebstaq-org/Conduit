import { List } from "@/ui";
import { HostStatusRows } from "./host-status-rows";
import { PairingForm } from "./pairing-form";
import type { HostPairingListProps } from "./host-pairing-types";

function HostPairingList({
  activeHost,
  connectionError,
  connectionStatus,
  offerUrl,
  onConnect,
  onForget,
  onOfferUrlChange,
  pairingError,
}: HostPairingListProps): React.JSX.Element {
  return (
    <List>
      <HostStatusRows
        activeHost={activeHost}
        connectionError={connectionError}
        connectionStatus={connectionStatus}
        onForget={onForget}
      />
      <PairingForm
        offerUrl={offerUrl}
        onConnect={onConnect}
        onOfferUrlChange={onOfferUrlChange}
        pairingError={pairingError}
      />
    </List>
  );
}

export { HostPairingList };
