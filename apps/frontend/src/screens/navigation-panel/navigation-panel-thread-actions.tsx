import { IconButton } from "@/ui";

function handleMockAction(): boolean {
  return false;
}

function NavigationPanelThreadActions(): React.JSX.Element {
  return (
    <>
      <IconButton
        accessibilityLabel="Collapse threads"
        icon="minimize-2"
        onPress={handleMockAction}
      />
      <IconButton
        accessibilityLabel="Filter threads"
        icon="filter"
        onPress={handleMockAction}
      />
      <IconButton
        accessibilityLabel="Create thread"
        icon="plus"
        onPress={handleMockAction}
      />
    </>
  );
}

export { NavigationPanelThreadActions };
