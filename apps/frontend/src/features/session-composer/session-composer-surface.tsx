import type { ProviderId, SessionConfigOption } from "@conduit/session-client";
import type {
  ActiveSession,
  SessionComposerPlanInteractionActions,
  SessionComposerPlanInteractionView,
} from "@/app-state";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { GlimmerText } from "@/ui";
import { SessionComposerPlanInteractionSurface } from "./session-composer-plan-interaction";
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

const sessionComposerActivityLabel = "Working...";

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
  isWorking: boolean;
  planInteractionActions: SessionComposerPlanInteractionActions;
  planInteractionView: SessionComposerPlanInteractionView;
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

function renderPromptTurnStatus(
  isWorking: boolean,
  theme: Theme,
): React.JSX.Element {
  return (
    <Box
      minHeight={theme.textVariants.meta.lineHeight}
      pb="xxs"
      px={sessionComposerPaddingX}
    >
      {isWorking && <GlimmerText text={sessionComposerActivityLabel} />}
    </Box>
  );
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

function renderInteractionBody(args: {
  activeCard: NonNullable<SessionComposerPlanInteractionView["activeCard"]>;
  planInteractionActions: SessionComposerPlanInteractionActions;
  planInteractionView: SessionComposerPlanInteractionView;
}): React.JSX.Element {
  return (
    <SessionComposerPlanInteractionSurface
      actions={args.planInteractionActions}
      canSubmit={args.planInteractionView.canSubmit}
      card={args.activeCard}
      otherText={args.planInteractionView.otherText}
      selectedOptionId={args.planInteractionView.selectedOptionId}
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
  planInteractionActions: SessionComposerPlanInteractionActions;
  planInteractionView: SessionComposerPlanInteractionView;
  setDraft: (draft: string) => void;
}): React.JSX.Element {
  if (args.planInteractionView.activeCard === null) {
    return renderStandardComposerBody(args);
  }
  return renderInteractionBody({
    activeCard: args.planInteractionView.activeCard,
    planInteractionActions: args.planInteractionActions,
    planInteractionView: args.planInteractionView,
  });
}

function createActiveComposerSurfaceStyle(args: {
  activeCard: SessionComposerPlanInteractionView["activeCard"];
  theme: Theme;
}): ReturnType<typeof createSessionComposerSurfaceStyle> {
  if (args.activeCard !== null) {
    return createSessionComposerInteractionSurfaceStyle();
  }
  return createSessionComposerSurfaceStyle(args.theme);
}

function SessionComposerSurface(
  props: SessionComposerSurfaceProps,
): React.JSX.Element {
  const composerBody = renderComposerBody({
    activeSession: props.activeSession,
    canSend: props.canSend,
    configOptions: props.configOptions,
    draft: props.draft,
    isConfigUpdating: props.isConfigUpdating,
    onConfigOptionSelect: props.onConfigOptionSelect,
    onProviderSelect: props.onProviderSelect,
    onSend: props.onSend,
    planInteractionActions: props.planInteractionActions,
    planInteractionView: props.planInteractionView,
    setDraft: props.setDraft,
  });
  const surfaceStyle = createActiveComposerSurfaceStyle({
    activeCard: props.planInteractionView.activeCard,
    theme: props.theme,
  });
  return (
    <Box gap="xxs">
      {renderPromptTurnStatus(props.isWorking, props.theme)}
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
        {renderComposerErrorMessage(props.errorMessage)}
      </Box>
    </Box>
  );
}

export { SessionComposerSurface };
