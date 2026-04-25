import { Box } from "@/theme";
import { TextButton } from "@/ui";
import type { PendingAction } from "./desktop-pairing-state";

function DesktopPairingControlButtons({
  onRestart,
  onStatus,
  pending,
}: {
  readonly onRestart: () => void;
  readonly onStatus: () => void;
  readonly pending: PendingAction;
}): React.JSX.Element {
  return (
    <Box flexDirection="row" gap="sm">
      <TextButton
        disabled={pending !== null}
        label="Refresh status"
        onPress={onStatus}
      />
      <TextButton
        disabled={pending !== null}
        label="Restart daemon"
        onPress={onRestart}
      />
    </Box>
  );
}

export { DesktopPairingControlButtons };
