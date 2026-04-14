import type { ProviderId } from "@conduit/session-client";
import { Box } from "@/theme";
import { DropdownMenuRoot, DropdownMenuTrigger } from "@/ui";
import { SessionComposerPreviewControlChip } from "./session-composer-control";
import { SessionComposerProviderMenu } from "./session-composer-provider-menu";
import {
  sessionComposerGap,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
} from "./session-composer.styles";

interface SessionComposerControlsProps {
  isDraft: boolean;
  onProviderSelect: (provider: ProviderId) => void;
  provider: ProviderId | null;
}

function renderComposerControl(
  provider: string | null,
  showChevron: boolean,
): React.JSX.Element {
  return (
    <SessionComposerPreviewControlChip
      control={{ label: "Provider", value: provider ?? "Select provider" }}
      key={provider ?? "select-provider"}
      showChevron={showChevron}
    />
  );
}

function renderDraftControls({
  onProviderSelect,
  provider,
}: Pick<
  SessionComposerControlsProps,
  "onProviderSelect" | "provider"
>): React.JSX.Element {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger accessibilityLabel="Select provider for new session">
        {renderComposerControl(provider, true)}
      </DropdownMenuTrigger>
      <SessionComposerProviderMenu onProviderSelect={onProviderSelect} />
    </DropdownMenuRoot>
  );
}

function renderOpenControls(
  provider: ProviderId | null,
): React.JSX.Element | null {
  if (provider === null) {
    return null;
  }
  return renderComposerControl(provider, false);
}

function renderControls(
  props: SessionComposerControlsProps,
): React.JSX.Element | null {
  if (props.isDraft) {
    return renderDraftControls(props);
  }
  return renderOpenControls(props.provider);
}

function SessionComposerControls({
  isDraft,
  onProviderSelect,
  provider,
}: SessionComposerControlsProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      gap={sessionComposerGap}
    >
      {renderControls({ isDraft, onProviderSelect, provider })}
    </Box>
  );
}

export { SessionComposerControls };
