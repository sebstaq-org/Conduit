import { ProjectPickerTrigger } from "@/features/project-picker";
import { IconButton } from "@/ui";

function handleMockAction(): boolean {
  return false;
}

function NavigationPanelThreadActions(): React.JSX.Element {
  return (
    <>
      <IconButton
        accessibilityLabel="Collapse sessions"
        icon="minimize-2"
        onPress={handleMockAction}
      />
      <IconButton
        accessibilityLabel="Filter sessions"
        icon="filter"
        onPress={handleMockAction}
      />
      <ProjectPickerTrigger />
    </>
  );
}

export { NavigationPanelThreadActions };
