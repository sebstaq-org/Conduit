import {
  desktopBridge,
  desktopBridgeAvailable,
} from "@/app-state/desktop-bridge";
import { Box, Text } from "@/theme";
import {
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverRoot,
  PopoverStatusTrigger,
} from "@/ui";
import { DesktopPairingBody } from "./desktop-pairing-body";
import { desktopPairingPresentation } from "./desktop-pairing-status";
import { useDesktopPairingState } from "./desktop-pairing-state";

function renderDesktopPairingPopoverContent(args: {
  presentation: ReturnType<typeof desktopPairingPresentation>;
  state: ReturnType<typeof useDesktopPairingState>;
}): React.JSX.Element {
  return (
    <Box gap="md">
      <Text variant="panelHeading">Mobile pairing</Text>
      <DesktopPairingBody
        presentation={args.presentation}
        state={args.state}
      />
    </Box>
  );
}

function DesktopPairingPopover(): React.JSX.Element | null {
  const bridge = desktopBridge();
  const state = useDesktopPairingState(bridge);

  if (!desktopBridgeAvailable() || bridge === null) {
    return null;
  }

  const presentation = desktopPairingPresentation({
    actionError: state.actionError,
    offerReady: state.offer !== null,
    pending: state.pending,
    status: state.status,
  });

  return (
    <PopoverRoot>
      <PopoverStatusTrigger
        accessibilityLabel="Mobile pairing controls"
        status={presentation.indicator}
      />
      <PopoverPortal>
        <PopoverOverlay />
        <PopoverContent>
          {renderDesktopPairingPopoverContent({ presentation, state })}
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  );
}

export { DesktopPairingPopover };
