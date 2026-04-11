import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui";
import {
  createSessionComposerControlStyle,
  sessionComposerControlBackgroundColor,
  sessionComposerControlBorderRadius,
  sessionComposerControlGap,
  sessionComposerControlTextVariant,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
} from "./session-composer.styles";
import type { SessionComposerPreviewControl } from "./session-composer.styles";

interface SessionComposerPreviewControlChipProps {
  control: SessionComposerPreviewControl;
}

function SessionComposerPreviewControlChip({
  control,
}: SessionComposerPreviewControlChipProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      backgroundColor={sessionComposerControlBackgroundColor}
      borderRadius={sessionComposerControlBorderRadius}
      flexDirection={sessionComposerRowFlexDirection}
      gap={sessionComposerControlGap}
      style={createSessionComposerControlStyle(theme)}
    >
      <Text
        accessibilityLabel={control.label}
        variant={sessionComposerControlTextVariant}
      >
        {control.value}
      </Text>
      <IconSlot name="chevron-down" />
    </Box>
  );
}

export { SessionComposerPreviewControlChip };
