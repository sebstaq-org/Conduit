import { MultilineInput } from "@/ui";
import {
  sessionComposerAccessibilityLabel,
  sessionComposerPlaceholder,
} from "./session-composer.styles";

interface SessionComposerInputProps {
  disabled: boolean;
  draft: string;
  onSend: () => void;
  setDraft: (draft: string) => void;
}

function SessionComposerInput({
  disabled,
  draft,
  onSend,
  setDraft,
}: SessionComposerInputProps): React.JSX.Element {
  return (
    <MultilineInput
      accessibilityLabel={sessionComposerAccessibilityLabel}
      disabled={disabled}
      onChangeText={setDraft}
      onEnterWithoutShift={onSend}
      placeholder={sessionComposerPlaceholder}
      value={draft}
    />
  );
}

export { SessionComposerInput };
