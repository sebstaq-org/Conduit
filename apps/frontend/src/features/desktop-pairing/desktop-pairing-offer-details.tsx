import { Box } from "@/theme";
import { QrImage, TextButton, TextField } from "@/ui";
import type { DesktopPairingOffer } from "@/app-state/desktop-bridge";

function ignoreReadOnlyEdit(value: string): void {
  void value;
}

function DesktopPairingOfferDetails({
  offer,
  onCopy,
}: {
  readonly offer: DesktopPairingOffer;
  readonly onCopy: () => void;
}): React.JSX.Element {
  return (
    <Box gap="sm">
      <QrImage
        accessibilityLabel="Mobile pairing QR"
        dataUrl={offer.qrDataUrl}
      />
      <TextField
        accessibilityLabel="Mobile pairing link"
        disabled
        onChangeText={ignoreReadOnlyEdit}
        placeholder="Mobile pairing link"
        value={offer.mobileUrl}
      />
      <TextButton label="Copy mobile pairing link" onPress={onCopy} />
    </Box>
  );
}

export { DesktopPairingOfferDetails };
