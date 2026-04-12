import { PopoverIconTrigger } from "@/ui/popover";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";

interface MenuIconTriggerProps {
  accessibilityLabel: string;
  icon: IconSlotName;
}

function MenuIconTrigger({
  accessibilityLabel,
  icon,
}: MenuIconTriggerProps): React.JSX.Element {
  return (
    <PopoverIconTrigger accessibilityLabel={accessibilityLabel} icon={icon} />
  );
}

export { MenuIconTrigger };
