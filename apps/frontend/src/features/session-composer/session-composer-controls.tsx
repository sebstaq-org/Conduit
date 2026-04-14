import type { ProviderId } from "@conduit/session-client";
import { Box } from "@/theme";
import { MenuIconTrigger, MenuPortal, MenuRoot } from "@/ui";
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

function renderComposerControl(provider: string | null): React.JSX.Element {
  return (
    <SessionComposerPreviewControlChip
      control={{ label: "Provider", value: provider ?? "Select provider" }}
      key={provider ?? "select-provider"}
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
    <MenuRoot>
      <MenuIconTrigger
        accessibilityLabel="Select provider for new session"
        icon="chevron-down"
      />
      {renderComposerControl(provider)}
      <MenuPortal>
        <SessionComposerProviderMenu onProviderSelect={onProviderSelect} />
      </MenuPortal>
    </MenuRoot>
  );
}

function renderOpenControls(
  provider: ProviderId | null,
): React.JSX.Element | null {
  if (provider === null) {
    return null;
  }
  return renderComposerControl(provider);
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
