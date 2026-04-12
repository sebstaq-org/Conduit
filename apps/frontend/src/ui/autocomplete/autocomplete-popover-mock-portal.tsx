import {
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
} from "@/ui/popover";
import { AutocompletePopoverMockContent } from "./autocomplete-popover-mock-content";

function renderAutocompletePopoverMockContent(): React.ReactNode {
  return <AutocompletePopoverMockContent />;
}

function AutocompletePopoverMockPortal(): React.JSX.Element {
  return (
    <PopoverPortal>
      <PopoverOverlay />
      <PopoverContent>{renderAutocompletePopoverMockContent()}</PopoverContent>
    </PopoverPortal>
  );
}

export { AutocompletePopoverMockPortal };
