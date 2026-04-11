import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const metaStyles = StyleSheet.create({
  text: {
    color: panelTokens.colors.mutedText,
    fontSize: 14,
    fontWeight: panelTokens.font.medium,
    lineHeight: 18,
  },
});

export { metaStyles };
