import { Box, Text } from "@/theme";
import {
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverRoot,
  PopoverStatusTrigger,
} from "@/ui";
import { HostPairingBody } from "./host-pairing-body";
import { useHostPairingModel } from "./host-pairing-model";

function renderHostPairingPopoverContent(
  model: ReturnType<typeof useHostPairingModel>,
): React.JSX.Element {
  const handleConnect = model.onConnect;
  const handleForget = model.onForget;
  const handleOfferUrlChange = model.onOfferUrlChange;

  return (
    <Box gap="md">
      <Text variant="panelHeading">Desktop</Text>
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
    </Box>
  );
}

function HostPairingPopover(): React.JSX.Element {
  const model = useHostPairingModel();

  return (
    <PopoverRoot>
      <PopoverStatusTrigger
        accessibilityLabel="Desktop connection controls"
        status={model.connectionIndicator}
      />
      <PopoverPortal>
        <PopoverOverlay />
        <PopoverContent>
          {renderHostPairingPopoverContent(model)}
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  );
}

export { HostPairingPopover };
