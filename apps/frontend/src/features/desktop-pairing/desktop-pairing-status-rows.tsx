import { ConnectionStatusIndicator, Row } from "@/ui";
import type { DesktopPairingPresentation } from "./desktop-pairing-status";

function DesktopPairingStatusRows({
  presentation,
}: {
  readonly presentation: DesktopPairingPresentation;
}): React.JSX.Element {
  return (
    <Row
      label="Mobile pairing"
      leading={
        <ConnectionStatusIndicator
          label={`Mobile pairing ${presentation.indicator} indicator`}
          status={presentation.indicator}
        />
      }
      muted={presentation.indicator === "idle"}
    />
  );
}

export { DesktopPairingStatusRows };
