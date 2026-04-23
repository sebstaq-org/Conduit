import { Text } from "@/theme";
import { List, Section, TextButton } from "@/ui";
import { DesktopPairingControlButtons } from "./desktop-pairing-control-buttons";
import { DesktopPairingOfferDetails } from "./desktop-pairing-offer-details";
import { DesktopPairingStatusRows } from "./desktop-pairing-status-rows";
import type { DesktopPairingState } from "./desktop-pairing-state";

function DesktopPairingContent({
  state,
}: {
  readonly state: DesktopPairingState;
}): React.JSX.Element {
  return (
    <Section title="Mobile pairing">
      <List>
        <DesktopPairingStatusRows status={state.status} />
        <DesktopPairingControlButtons
          onRestart={state.handleRestart}
          onStatus={state.handleStatus}
          pending={state.pending}
        />
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
    </Section>
  );
}

export { DesktopPairingContent };
