import { Image } from "react-native";

interface QrImageProps {
  accessibilityLabel: string;
  dataUrl: string;
}

function QrImage({
  accessibilityLabel,
  dataUrl,
}: QrImageProps): React.JSX.Element {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={{ uri: dataUrl }}
      style={{ height: 180, width: 180 }}
    />
  );
}

export { QrImage };
