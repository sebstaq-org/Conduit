import { ConnectionStatusIndicator, Row } from "@/ui";
import type { DesktopPairingPresentation } from "./desktop-pairing-status";

function connectedClientMeta(count: number): string | undefined {
  if (count <= 0) {
    return undefined;
  }
  return `${String(count)} client connected`;
}

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
      meta={connectedClientMeta(presentation.connectedClientCount)}
      muted={presentation.indicator === "idle"}
    />
  );
}

export { DesktopPairingStatusRows };
