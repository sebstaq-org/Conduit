import { Content } from "@rn-primitives/dropdown-menu";
import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import type { Theme } from "@/theme";
import {
  createDropdownMenuContentStyle,
  dropdownMenuContentAlign,
  dropdownMenuContentSide,
  dropdownMenuContentSideOffset,
} from "./dropdown-menu.styles";

interface DropdownMenuContentProps {
  children: ReactNode;
}

function DropdownMenuContent({
  children,
}: DropdownMenuContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Content
      align={dropdownMenuContentAlign}
      side={dropdownMenuContentSide()}
      sideOffset={dropdownMenuContentSideOffset}
      style={createDropdownMenuContentStyle(theme)}
    >
      {children}
    </Content>
  );
}

export { DropdownMenuContent };
