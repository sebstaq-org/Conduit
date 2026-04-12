import { MultilineInput } from "@/ui";
import {
  sessionComposerAccessibilityLabel,
  sessionComposerPlaceholder,
} from "./session-composer.styles";

interface SessionComposerInputProps {
  draft: string;
  setDraft: (draft: string) => void;
}

function SessionComposerInput({
  draft,
  setDraft,
}: SessionComposerInputProps): React.JSX.Element {
  return (
    <MultilineInput
      accessibilityLabel={sessionComposerAccessibilityLabel}
      onChangeText={setDraft}
      placeholder={sessionComposerPlaceholder}
      value={draft}
    />
  );
}

export { SessionComposerInput };
