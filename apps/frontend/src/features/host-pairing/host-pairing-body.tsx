import { HostPairingList } from "./host-pairing-list";
import type { HostPairingListProps } from "./host-pairing-types";

function HostPairingBody({
  activeHost,
  connectionError,
  connectionIndicator,
  connectionReason,
  connectionStatus,
  offerUrl,
  onConnect: handleConnect,
  onForget: handleForget,
  onOfferUrlChange: handleOfferUrlChange,
  pairingError,
}: HostPairingListProps): React.JSX.Element {
  return (
    <HostPairingList
      activeHost={activeHost}
      connectionError={connectionError}
      connectionIndicator={connectionIndicator}
      connectionReason={connectionReason}
      connectionStatus={connectionStatus}
      offerUrl={offerUrl}
      onConnect={handleConnect}
      onForget={handleForget}
      onOfferUrlChange={handleOfferUrlChange}
      pairingError={pairingError}
    />
  );
}

export { HostPairingBody };
