import { Portal } from "@rn-primitives/popover";
import type { ReactNode } from "react";

interface PopoverPortalProps {
  children: ReactNode;
}

function PopoverPortal({ children }: PopoverPortalProps): React.JSX.Element {
  return (
    <Portal>
      {/* oxlint-disable-next-line react/jsx-no-useless-fragment -- Radix Portal calls React.Children.only on web. */}
      <>{children}</>
    </Portal>
  );
}

export { PopoverPortal };
