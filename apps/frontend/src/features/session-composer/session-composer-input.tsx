import { MultilineInput } from "@/ui";
import {
  sessionComposerAccessibilityLabel,
  sessionComposerPlaceholder,
} from "./session-composer.styles";

interface SessionComposerInputProps {
  draft: string;
  onSend: () => void;
  setDraft: (draft: string) => void;
}

function SessionComposerInput({
  draft,
  onSend,
  setDraft,
}: SessionComposerInputProps): React.JSX.Element {
  return (
    <MultilineInput
      accessibilityLabel={sessionComposerAccessibilityLabel}
      onChangeText={setDraft}
      onEnterWithoutShift={onSend}
      placeholder={sessionComposerPlaceholder}
      value={draft}
    />
  );
}

export { SessionComposerInput };
