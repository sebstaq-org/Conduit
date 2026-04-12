import { Content } from "@rn-primitives/popover";
import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import type { Theme } from "@/theme";
import {
  createMenuContentStyle,
  menuContentAlign,
  menuContentSide,
  menuContentSideOffset,
} from "./menu.styles";

interface MenuContentProps {
  children: ReactNode;
}

function MenuContent({ children }: MenuContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Content
      align={menuContentAlign}
      side={menuContentSide}
      sideOffset={menuContentSideOffset}
      style={createMenuContentStyle(theme)}
    >
      {children}
    </Content>
  );
}

export { MenuContent };
