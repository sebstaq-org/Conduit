import { useTheme } from "@shopify/restyle";
import { ActivityIndicator } from "react-native";
import { Box } from "@/theme";
import type { Theme } from "@/theme";

function Spinner(): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Box
      accessibilityLabel="Working"
      accessible
      alignItems="center"
      height={theme.panel.icon}
      justifyContent="center"
      width={theme.panel.icon}
    >
      <ActivityIndicator
        color={theme.colors.textPrimary}
        size={theme.panel.icon}
      />
    </Box>
  );
}

export { Spinner };
