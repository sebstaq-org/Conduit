import { PopoverContent, PopoverOverlay, PopoverPortal } from "@/ui/popover";
import { ProjectPickerContent } from "./project-picker-content";

function renderProjectPickerContent(): React.ReactNode {
  return <ProjectPickerContent />;
}

function ProjectPickerPortal(): React.JSX.Element {
  return (
    <PopoverPortal>
      <PopoverOverlay />
      <PopoverContent>{renderProjectPickerContent()}</PopoverContent>
    </PopoverPortal>
  );
}

export { ProjectPickerPortal };
