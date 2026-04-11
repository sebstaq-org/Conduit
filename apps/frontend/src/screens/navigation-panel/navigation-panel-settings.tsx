import { PanelFooter, Row } from "@/ui";

function handleMockSettingsPress(): boolean {
  return false;
}

function NavigationPanelSettings(): React.JSX.Element {
  return (
    <PanelFooter>
      <Row icon="settings" label="Settings" onPress={handleMockSettingsPress} />
    </PanelFooter>
  );
}

export { NavigationPanelSettings };
