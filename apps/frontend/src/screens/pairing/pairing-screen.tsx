import { HostPairingPanel } from "@/features/host-pairing";
import { Box, Text } from "@/theme";
import Constants from "expo-constants";

interface PairingScreenProps {
  offer?: string | undefined;
}

function pairingScheme(): "conduit" | "conduit-dev" {
  if (Constants.expoConfig?.extra?.appVariant === "dev") {
    return "conduit-dev";
  }
  return "conduit";
}

function offerUrl(offer: string | undefined): string | undefined {
  if (offer === undefined || offer.length === 0) {
    return undefined;
  }
  return `${pairingScheme()}://pair?offer=${offer}`;
}

function PairingScreen({ offer }: PairingScreenProps): React.JSX.Element {
  const pairingOfferUrl = offerUrl(offer);
  return (
    <Box flex={1} gap="md" p="contentX">
      <Text variant="panelHeading">Conduit</Text>
      <HostPairingPanel
        key={pairingOfferUrl ?? "manual-pairing"}
        initialOfferUrl={pairingOfferUrl}
      />
    </Box>
  );
}

export { PairingScreen };
