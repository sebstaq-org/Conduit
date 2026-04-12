import {
  PopoverIconTrigger,
  PopoverRoot,
} from "@/ui/popover";
import { ProjectPickerPortal } from "./project-picker-portal";

function ProjectsToolbar(): React.JSX.Element {
  return (
    <PopoverRoot>
      <PopoverIconTrigger accessibilityLabel="Add project" icon="plus" />
      <ProjectPickerPortal />
    </PopoverRoot>
  );
}

export { ProjectsToolbar };
