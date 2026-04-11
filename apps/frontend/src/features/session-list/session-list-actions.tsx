import { IconButton } from "@/ui";

function handleMockAction(): boolean {
  return false;
}

function SessionListActions(): React.JSX.Element {
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
      <IconButton
        accessibilityLabel="Create session"
        icon="plus"
        onPress={handleMockAction}
      />
    </>
  );
}

export { SessionListActions };
