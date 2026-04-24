import { Section } from "@/ui";
import { HostPairingBody } from "./host-pairing-body";
import { useHostPairingModel } from "./host-pairing-model";
import type { HostPairingPanelProps } from "./host-pairing-types";

function HostPairingPanel({
  initialOfferUrl,
}: HostPairingPanelProps): React.JSX.Element {
  const model = useHostPairingModel({ initialOfferUrl });
  const handleConnect = model.onConnect;
  const handleForget = model.onForget;
  const handleOfferUrlChange = model.onOfferUrlChange;

  return (
    <Section title="Desktop">
      <HostPairingBody
        activeHost={model.activeHost}
        connectionError={model.connectionError}
        connectionIndicator={model.connectionIndicator}
        connectionReason={model.connectionReason}
        connectionStatus={model.connectionStatus}
        offerUrl={model.offerUrl}
        onConnect={handleConnect}
        onForget={handleForget}
        onOfferUrlChange={handleOfferUrlChange}
        pairingError={model.pairingError}
      />
    </Section>
  );
}

export { HostPairingPanel };
