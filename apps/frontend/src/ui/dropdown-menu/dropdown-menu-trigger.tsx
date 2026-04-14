import { Trigger } from "@rn-primitives/dropdown-menu";
import type { ReactNode } from "react";

interface DropdownMenuTriggerProps {
  accessibilityLabel?: string | undefined;
  asChild?: boolean | undefined;
  children: ReactNode;
  disabled?: boolean | undefined;
}

function DropdownMenuTrigger({
  accessibilityLabel,
  asChild = false,
  children,
  disabled = false,
}: DropdownMenuTriggerProps): React.JSX.Element {
  return (
    <Trigger
      accessibilityLabel={accessibilityLabel}
      asChild={asChild}
      disabled={disabled}
    >
      {children}
    </Trigger>
  );
}

export { DropdownMenuTrigger };
