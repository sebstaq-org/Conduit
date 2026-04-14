import { Root } from "@rn-primitives/dropdown-menu";
import type { ReactNode } from "react";

interface DropdownMenuRootProps {
  children: ReactNode;
}

function DropdownMenuRoot({
  children,
}: DropdownMenuRootProps): React.JSX.Element {
  return <Root>{children}</Root>;
}

export { DropdownMenuRoot };
