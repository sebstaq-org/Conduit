import type { ProviderId, SessionConfigOption } from "@conduit/session-client";
import { Box } from "@/theme";
import { DropdownMenuRoot, DropdownMenuTrigger } from "@/ui";
import { SessionComposerPreviewControlChip } from "./session-composer-control";
import { SessionComposerConfigOptionMenu } from "./session-composer-config-option-menu";
import { displayProviderName } from "./session-composer-display";
import { SessionComposerProviderMenu } from "./session-composer-provider-menu";
import {
  sessionComposerGap,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
} from "./session-composer.styles";

interface SessionComposerControlsProps {
  configOptions: SessionConfigOption[] | null;
  isDraft: boolean;
  isUpdatingConfig: boolean;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  provider: ProviderId | null;
}

function renderComposerControl(
  provider: ProviderId | null,
  showChevron: boolean,
): React.JSX.Element {
  return (
    <SessionComposerPreviewControlChip
      control={{ label: "Provider", value: displayProviderName(provider) }}
      key={provider ?? "select-provider"}
      showChevron={showChevron}
    />
  );
}

function renderDraftControls({
  configOptions,
  isUpdatingConfig,
  onConfigOptionSelect,
  onProviderSelect,
  provider,
}: Pick<
  SessionComposerControlsProps,
  | "configOptions"
  | "isUpdatingConfig"
  | "onConfigOptionSelect"
  | "onProviderSelect"
  | "provider"
>): React.JSX.Element[] {
  const controls: React.JSX.Element[] = [
    <DropdownMenuRoot key={`provider-${provider ?? "select-provider"}`}>
      <DropdownMenuTrigger accessibilityLabel="Select provider for new session">
        {renderComposerControl(provider, true)}
      </DropdownMenuTrigger>
      <SessionComposerProviderMenu onProviderSelect={onProviderSelect} />
    </DropdownMenuRoot>,
  ];
  if (configOptions !== null) {
    for (const option of configOptions) {
      controls.push(
        <SessionComposerConfigOptionMenu
          disabled={isUpdatingConfig}
          key={option.id}
          onSelect={onConfigOptionSelect}
          option={option}
        />,
      );
    }
  }
  return controls;
}

function renderOpenControls({
  configOptions,
  isUpdatingConfig,
  onConfigOptionSelect,
  provider,
}: Pick<
  SessionComposerControlsProps,
  "configOptions" | "isUpdatingConfig" | "onConfigOptionSelect" | "provider"
>): React.JSX.Element[] | null {
  if (provider === null) {
    return null;
  }
  const controls: React.JSX.Element[] = [
    renderComposerControl(provider, false),
  ];
  if (configOptions !== null) {
    for (const option of configOptions) {
      controls.push(
        <SessionComposerConfigOptionMenu
          disabled={isUpdatingConfig}
          key={option.id}
          onSelect={onConfigOptionSelect}
          option={option}
        />,
      );
    }
  }
  return controls;
}

function renderControls(
  props: SessionComposerControlsProps,
): React.JSX.Element[] | null {
  if (props.isDraft) {
    return renderDraftControls(props);
  }
  return renderOpenControls(props);
}

function SessionComposerControls({
  configOptions,
  isDraft,
  isUpdatingConfig,
  onConfigOptionSelect,
  onProviderSelect,
  provider,
}: SessionComposerControlsProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      gap={sessionComposerGap}
    >
      {renderControls({
        configOptions,
        isDraft,
        isUpdatingConfig,
        onConfigOptionSelect,
        onProviderSelect,
        provider,
      })}
    </Box>
  );
}

export { SessionComposerControls };
