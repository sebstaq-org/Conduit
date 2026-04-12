import type { ReactNode } from "react";
import { PopoverOverlay, PopoverPortal } from "@/ui/popover";
import { MenuContent } from "./menu-content";

interface MenuPortalProps {
  children: ReactNode;
}

function MenuPortal({ children }: MenuPortalProps): React.JSX.Element {
  return (
    <PopoverPortal>
      <PopoverOverlay />
      <MenuContent>{children}</MenuContent>
    </PopoverPortal>
  );
}

export { MenuPortal };
