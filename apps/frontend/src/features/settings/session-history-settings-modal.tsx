import { useState } from "react";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "@/app-state";
import { ModalContent, ModalOverlay, ModalPortal } from "@/ui/modal";
import { SessionHistorySettingsModalContent } from "./session-history-settings-modal-content";
import {
  lookbackDraftValue,
  parseLookbackDays,
} from "./session-history-settings-values";

interface SessionHistorySettingsModalProps {
  onClose: () => void;
}

function SessionHistorySettingsModal({
  onClose,
}: SessionHistorySettingsModalProps): React.JSX.Element {
  const { data, isLoading } = useGetSettingsQuery(null);
  const [updateSettings, updateState] = useUpdateSettingsMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const value = lookbackDraftValue(draft, data?.sessionGroupsUpdatedWithinDays);
  const parsed = parseLookbackDays(value);
  const disabled = isLoading || updateState.isLoading;
  const canSave = parsed !== undefined && !disabled;

  const handleSave = (): void => {
    if (parsed === undefined) {
      return;
    }
    setDraft(null);
    onClose();
    void updateSettings({ sessionGroupsUpdatedWithinDays: parsed });
  };

  return (
    <ModalPortal>
      <ModalOverlay onPress={onClose} />
      <ModalContent>
        <SessionHistorySettingsModalContent
          canSave={canSave}
          disabled={disabled}
          onChangeText={setDraft}
          onSave={handleSave}
          value={value}
        />
      </ModalContent>
    </ModalPortal>
  );
}

export { SessionHistorySettingsModal };
