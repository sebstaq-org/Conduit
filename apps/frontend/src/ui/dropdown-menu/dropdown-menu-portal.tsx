import { Portal } from "@rn-primitives/dropdown-menu";
import type { ReactNode } from "react";

interface DropdownMenuPortalProps {
  readonly children: ReactNode;
}

function DropdownMenuPortal({
  children,
}: DropdownMenuPortalProps): React.JSX.Element {
  return <Portal>{children}</Portal>;
}

export { DropdownMenuPortal };
