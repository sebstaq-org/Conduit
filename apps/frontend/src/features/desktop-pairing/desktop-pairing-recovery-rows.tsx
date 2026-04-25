import { ConnectionStatusIndicator, Row } from "@/ui";

function DesktopPairingRecoveryRows(): React.JSX.Element {
  return (
    <Row
      label="Desktop needs attention"
      leading={
        <ConnectionStatusIndicator
          label="Mobile pairing disconnected indicator"
          status="disconnected"
        />
      }
    />
  );
}

export { DesktopPairingRecoveryRows };
