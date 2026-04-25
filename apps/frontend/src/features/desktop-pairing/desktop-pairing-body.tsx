import { Box, Text } from "@/theme";
import { List, TextButton } from "@/ui";
import { DesktopPairingControlButtons } from "./desktop-pairing-control-buttons";
import { DesktopPairingOfferDetails } from "./desktop-pairing-offer-details";
import { DesktopPairingRecoveryRows } from "./desktop-pairing-recovery-rows";
import { DesktopPairingStatusRows } from "./desktop-pairing-status-rows";
import type { DesktopPairingPresentation } from "./desktop-pairing-status";
import type { DesktopPairingState } from "./desktop-pairing-state";

interface DesktopPairingBodyProps {
  readonly presentation: DesktopPairingPresentation;
  readonly state: DesktopPairingState;
}

function DesktopPairingBody({
  presentation,
  state,
}: DesktopPairingBodyProps): React.JSX.Element {
  return (
    <Box gap="sm">
      <List>
        {presentation.showMobilePairing && (
          <DesktopPairingStatusRows presentation={presentation} />
        )}
        {presentation.recoveryVisible && <DesktopPairingRecoveryRows />}
        {presentation.recoveryVisible && (
          <DesktopPairingControlButtons
            onRestart={state.handleRestart}
            onStatus={state.handleStatus}
            pending={state.pending}
          />
        )}
        <TextButton
          appearance="primary"
          disabled={state.pending !== null}
          label="Create mobile pairing link"
          onPress={state.handleOffer}
        />
        {state.offer !== null && (
          <DesktopPairingOfferDetails
            offer={state.offer}
            onCopy={state.handleCopy}
          />
        )}
        {state.pending !== null && <Text variant="meta">Working</Text>}
        {state.actionError !== null && (
          <Text variant="meta">{state.actionError}</Text>
        )}
      </List>
    </Box>
  );
}

export { DesktopPairingBody };
