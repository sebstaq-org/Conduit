import { Section } from "@/ui";
import { DesktopPairingBody } from "./desktop-pairing-body";
import { desktopPairingPresentation } from "./desktop-pairing-status";
import type { DesktopPairingState } from "./desktop-pairing-state";

function DesktopPairingContent({
  state,
}: {
  readonly state: DesktopPairingState;
}): React.JSX.Element {
  const presentation = desktopPairingPresentation({
    actionError: state.actionError,
    offerReady: state.offer !== null,
    pending: state.pending,
    status: state.status,
  });
  return (
    <Section title="Mobile pairing">
      <DesktopPairingBody presentation={presentation} state={state} />
    </Section>
  );
}

export { DesktopPairingContent };
