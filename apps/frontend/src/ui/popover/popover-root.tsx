import { Root } from "@rn-primitives/popover";
import type { ReactNode } from "react";

interface PopoverRootProps {
  children: ReactNode;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

function PopoverRoot({
  children,
  onOpenChange,
}: PopoverRootProps): React.JSX.Element {
  return <Root onOpenChange={onOpenChange}>{children}</Root>;
}

export { PopoverRoot };
