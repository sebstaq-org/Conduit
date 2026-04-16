import type { ProviderId, SessionConfigOption } from "@conduit/session-client";
import type { ActiveSession } from "@/app-state";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import {
  SessionComposerPlanInteractionSurface,
} from "./session-composer-plan-interaction";
import type {
  SessionComposerPlanInteractionMockActions,
  SessionComposerPlanInteractionMockView,
} from "./session-composer-plan-interaction-mock";
import { SessionComposerActionRow } from "./session-composer-action-row";
import { SessionComposerInput } from "./session-composer-input";
import {
  createSessionComposerInteractionSurfaceStyle,
  createSessionComposerSurfaceStyle,
  sessionComposerBackgroundColor,
  sessionComposerBorderColor,
  sessionComposerBorderRadius,
  sessionComposerGap,
  sessionComposerPaddingX,
  sessionComposerPaddingY,
} from "./session-composer.styles";

interface SessionComposerSurfaceProps {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: SessionConfigOption[] | null;
  draft: string;
  errorMessage: string | null;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  onSend: () => void;
  isConfigUpdating: boolean;
  planInteractionMockActions: SessionComposerPlanInteractionMockActions;
  planInteractionMockView: SessionComposerPlanInteractionMockView;
  setDraft: (draft: string) => void;
  theme: Theme;
}

function renderComposerErrorMessage(
  message: string | null,
): React.JSX.Element | null {
  if (message === null) {
    return null;
  }
  return <Text variant="rowLabelMuted">{message}</Text>;
}

interface SessionComposerStandardBodyProps {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: SessionConfigOption[] | null;
  draft: string;
  isConfigUpdating: boolean;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  onSend: () => void;
  setDraft: (draft: string) => void;
}

function renderStandardComposerBody({
  activeSession,
  canSend,
  configOptions,
  draft,
  isConfigUpdating,
  onConfigOptionSelect,
  onProviderSelect,
  onSend,
  setDraft,
}: SessionComposerStandardBodyProps): React.JSX.Element {
  return (
    <>
      <SessionComposerInput draft={draft} setDraft={setDraft} />
      <SessionComposerActionRow
        canSend={canSend}
        configOptions={configOptions}
        isUpdatingConfig={isConfigUpdating}
        isDraft={activeSession?.kind === "draft"}
        onConfigOptionSelect={onConfigOptionSelect}
        onProviderSelect={onProviderSelect}
        onSend={onSend}
        provider={activeSession?.provider ?? null}
      />
    </>
  );
}

function renderMockInteractionBody(args: {
  activeMockCard: NonNullable<SessionComposerPlanInteractionMockView["activeCard"]>;
  planInteractionMockActions: SessionComposerPlanInteractionMockActions;
  planInteractionMockView: SessionComposerPlanInteractionMockView;
}): React.JSX.Element {
  return (
    <SessionComposerPlanInteractionSurface
      actions={args.planInteractionMockActions}
      canSubmit={args.planInteractionMockView.canSubmit}
      card={args.activeMockCard}
      otherText={args.planInteractionMockView.otherText}
      selectedOptionId={args.planInteractionMockView.selectedOptionId}
    />
  );
}

function renderComposerBody(args: {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: SessionConfigOption[] | null;
  draft: string;
  isConfigUpdating: boolean;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  onSend: () => void;
  planInteractionMockActions: SessionComposerPlanInteractionMockActions;
  planInteractionMockView: SessionComposerPlanInteractionMockView;
  setDraft: (draft: string) => void;
}): React.JSX.Element {
  if (args.planInteractionMockView.activeCard === null) {
    return renderStandardComposerBody(args);
  }
  return renderMockInteractionBody({
    activeMockCard: args.planInteractionMockView.activeCard,
    planInteractionMockActions: args.planInteractionMockActions,
    planInteractionMockView: args.planInteractionMockView,
  });
}

function createActiveComposerSurfaceStyle(args: {
  activeCard: SessionComposerPlanInteractionMockView["activeCard"];
  theme: Theme;
}): ReturnType<typeof createSessionComposerSurfaceStyle> {
  if (args.activeCard !== null) {
    return createSessionComposerInteractionSurfaceStyle();
  }
  return createSessionComposerSurfaceStyle(args.theme);
}

function SessionComposerSurface({
  activeSession,
  canSend,
  configOptions,
  draft,
  errorMessage,
  onConfigOptionSelect,
  onProviderSelect,
  onSend,
  isConfigUpdating,
  planInteractionMockActions,
  planInteractionMockView,
  setDraft,
  theme,
}: SessionComposerSurfaceProps): React.JSX.Element {
  const composerBody = renderComposerBody({
    activeSession,
    canSend,
    configOptions,
    draft,
    isConfigUpdating,
    onConfigOptionSelect,
    onProviderSelect,
    onSend,
    planInteractionMockActions,
    planInteractionMockView,
    setDraft,
  });
  const surfaceStyle = createActiveComposerSurfaceStyle({
    activeCard: planInteractionMockView.activeCard,
    theme,
  });
  return (
    <Box
      backgroundColor={sessionComposerBackgroundColor}
      borderColor={sessionComposerBorderColor}
      borderRadius={sessionComposerBorderRadius}
      borderWidth={1}
      gap={sessionComposerGap}
      px={sessionComposerPaddingX}
      py={sessionComposerPaddingY}
      style={surfaceStyle}
    >
      {composerBody}
      {renderComposerErrorMessage(errorMessage)}
    </Box>
  );
}

export { SessionComposerSurface };
