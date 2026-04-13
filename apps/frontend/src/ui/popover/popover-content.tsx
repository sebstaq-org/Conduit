import { Content } from "@rn-primitives/popover";
import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import type { Theme } from "@/theme";
import {
  createPopoverContentStyle,
  popoverContentAlign,
  popoverContentSide,
  popoverContentSideOffset,
} from "./popover.styles";

interface PopoverContentProps {
  children: ReactNode;
}

function PopoverContent({ children }: PopoverContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Content
      align={popoverContentAlign}
      side={popoverContentSide}
      sideOffset={popoverContentSideOffset}
      style={createPopoverContentStyle(theme)}
    >
      {children}
    </Content>
  );
}

export { PopoverContent };
