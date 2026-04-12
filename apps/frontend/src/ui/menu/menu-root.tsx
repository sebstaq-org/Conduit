import type { ReactNode } from "react";
import { PopoverRoot } from "@/ui/popover";

interface MenuRootProps {
  children: ReactNode;
}

function MenuRoot({ children }: MenuRootProps): React.JSX.Element {
  return <PopoverRoot>{children}</PopoverRoot>;
}

export { MenuRoot };
