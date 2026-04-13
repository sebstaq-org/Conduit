import { useState } from "react";
import { Row } from "@/ui";
import { SessionHistorySettingsModal } from "./session-history-settings-modal";

function SessionHistorySettingsControl(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const openSettings = (): void => {
    setOpen(true);
  };
  const closeSettings = (): void => {
    setOpen(false);
  };

  if (!open) {
    return <Row icon="settings" label="Settings" onPress={openSettings} />;
  }

  return (
    <>
      <Row icon="settings" label="Settings" onPress={openSettings} />
      <SessionHistorySettingsModal onClose={closeSettings} />
    </>
  );
}

export { SessionHistorySettingsControl };
