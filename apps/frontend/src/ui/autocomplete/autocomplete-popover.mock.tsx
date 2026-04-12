import { PopoverIconTrigger, PopoverRoot } from "@/ui/popover";
import { AutocompletePopoverMockPortal } from "./autocomplete-popover-mock-portal";

function AutocompletePopoverMock(): React.JSX.Element {
  return (
    <PopoverRoot>
      <PopoverIconTrigger
        accessibilityLabel="Open autocomplete mock"
        icon="plus"
      />
      <AutocompletePopoverMockPortal />
    </PopoverRoot>
  );
}

export { AutocompletePopoverMock };
