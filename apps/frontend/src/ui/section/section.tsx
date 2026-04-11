import type { ReactNode } from "react";
import { Box, Text } from "@/theme";
import {
  sectionActionsFlexDirection,
  sectionActionsGap,
  sectionHeaderAlignItems,
  sectionHeaderFlexDirection,
  sectionHeaderJustifyContent,
  sectionHeaderMarginBottom,
  sectionHeaderMarginTop,
  sectionTitleVariant,
} from "./section.styles";

interface SectionProps {
  actions?: ReactNode | undefined;
  children: ReactNode;
  title: string;
}

function Section({
  actions,
  children,
  title,
}: SectionProps): React.JSX.Element {
  return (
    <Box>
      <Box
        alignItems={sectionHeaderAlignItems}
        flexDirection={sectionHeaderFlexDirection}
        justifyContent={sectionHeaderJustifyContent}
        mb={sectionHeaderMarginBottom}
        mt={sectionHeaderMarginTop}
      >
        <Text variant={sectionTitleVariant}>{title}</Text>
        {actions !== undefined && (
          <Box
            flexDirection={sectionActionsFlexDirection}
            gap={sectionActionsGap}
          >
            {actions}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

export { Section };
