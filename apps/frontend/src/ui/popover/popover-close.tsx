import { Close } from "@rn-primitives/popover";
import type { ReactNode } from "react";

interface PopoverCloseProps {
  children: ReactNode;
}

function PopoverClose({ children }: PopoverCloseProps): React.JSX.Element {
  return <Close>{children}</Close>;
}

export { PopoverClose };
