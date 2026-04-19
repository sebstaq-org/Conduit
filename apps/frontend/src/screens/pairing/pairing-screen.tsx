import { HostPairingPanel } from "@/features/host-pairing";
import { Box, Text } from "@/theme";

interface PairingScreenProps {
  offer?: string | undefined;
}

function offerUrl(offer: string | undefined): string | undefined {
  if (offer === undefined || offer.length === 0) {
    return undefined;
  }
  return `conduit://pair#offer=${offer}`;
}

function PairingScreen({ offer }: PairingScreenProps): React.JSX.Element {
  return (
    <Box flex={1} gap="md" p="contentX">
      <Text variant="panelHeading">Conduit</Text>
      <HostPairingPanel initialOfferUrl={offerUrl(offer)} />
    </Box>
  );
}

export { PairingScreen };
