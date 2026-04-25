import { useTheme } from "@shopify/restyle";
import { ActivityIndicator } from "react-native";
import { Box } from "@/theme";
import type { Theme } from "@/theme";

type ConnectionStatusKind =
  | "connected"
  | "connecting"
  | "disconnected"
  | "idle";

interface ConnectionStatusIndicatorProps {
  readonly label: string;
  readonly status: ConnectionStatusKind;
}

const dotSize = 10;

function dotColor(
  status: Exclude<ConnectionStatusKind, "connecting">,
): keyof Theme["colors"] {
  if (status === "connected") {
    return "connectionConnected";
  }
  if (status === "idle") {
    return "connectionIdle";
  }
  return "connectionDisconnected";
}

function ConnectionStatusIndicator({
  label,
  status,
}: ConnectionStatusIndicatorProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  if (status === "connecting") {
    return (
      <Box
        accessibilityLabel={label}
        accessible
        alignItems="center"
        height={theme.panel.icon}
        justifyContent="center"
        width={theme.panel.icon}
      >
        <ActivityIndicator
          color={theme.colors.connectionConnecting}
          size={theme.panel.iconGlyph}
        />
      </Box>
    );
  }

  return (
    <Box
      accessibilityLabel={label}
      accessible
      alignItems="center"
      height={theme.panel.icon}
      justifyContent="center"
      width={theme.panel.icon}
    >
      <Box
        backgroundColor={dotColor(status)}
        borderRadius="panel"
        height={dotSize}
        width={dotSize}
      />
    </Box>
  );
}

export { ConnectionStatusIndicator };
export type { ConnectionStatusKind };
