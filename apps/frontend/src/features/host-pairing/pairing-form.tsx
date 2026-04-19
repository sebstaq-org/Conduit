import { Box, Text } from "@/theme";
import { TextButton, TextField } from "@/ui";
import type { PairingFormProps } from "./host-pairing-types";

function renderPairingError(message: string | null): React.JSX.Element | null {
  if (message === null) {
    return null;
  }
  return <Text variant="meta">{message}</Text>;
}

function PairingForm({
  offerUrl,
  onConnect,
  onOfferUrlChange,
  pairingError,
}: PairingFormProps): React.JSX.Element {
  const disabled = offerUrl.trim().length === 0;
  return (
    <Box gap="sm">
      <TextField
        accessibilityLabel="Pairing link"
        onChangeText={onOfferUrlChange}
        onSubmit={onConnect}
        placeholder="Paste pairing link"
        value={offerUrl}
      />
      <TextButton
        disabled={disabled}
        label="Connect desktop"
        onPress={onConnect}
      />
      {renderPairingError(pairingError)}
    </Box>
  );
}

export { PairingForm };
