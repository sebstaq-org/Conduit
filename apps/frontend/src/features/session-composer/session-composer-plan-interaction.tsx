import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { TextButton, TextField } from "@/ui";
import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
  SessionComposerPlanInteractionMockActions,
} from "./session-composer-plan-interaction-mock";
import {
  createPlanInteractionEscStyle,
  createPlanInteractionFooterStyle,
  createPlanInteractionHeaderStyle,
  createPlanInteractionInlineInputStyle,
} from "./session-composer-plan-interaction.styles";

interface SessionComposerPlanInteractionSurfaceProps {
  actions: SessionComposerPlanInteractionMockActions;
  card: PlanInteractionMockCard;
  canSubmit: boolean;
  otherText: string;
  selectedOptionId: string | null;
}

function optionLabel(index: number, option: PlanInteractionMockOption): string {
  return `${index + 1}. ${option.label}`;
}

function selectedOption(
  card: PlanInteractionMockCard,
  selectedOptionId: string | null,
): PlanInteractionMockOption | null {
  if (selectedOptionId === null) {
    return null;
  }
  return (
    card.options.find((option) => option.optionId === selectedOptionId) ?? null
  );
}

function resolveSubmitHandler(args: {
  actions: SessionComposerPlanInteractionMockActions;
  canSubmit: boolean;
}): (() => void) | undefined {
  if (!args.canSubmit) {
    return undefined;
  }
  return args.actions.submitInteraction;
}

function renderOptionRows(args: {
  card: PlanInteractionMockCard;
  onSelectOption: (optionId: string) => void;
  selectedOptionId: string | null;
}): React.JSX.Element {
  return (
    <Box gap="xs">
      {args.card.options.map((option, index) => (
        <TextButton
          key={option.optionId}
          label={optionLabel(index, option)}
          onPress={() => {
            args.onSelectOption(option.optionId);
          }}
          selected={option.optionId === args.selectedOptionId}
        />
      ))}
    </Box>
  );
}

function renderActionRows(args: {
  canSubmit: boolean;
  handleDismissInteraction: () => void;
  handleSubmit: (() => void) | undefined;
  submitLabel: string;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Box style={createPlanInteractionFooterStyle()}>
      <TextButton
        appearance="secondary"
        label="Dismiss"
        onPress={args.handleDismissInteraction}
      />
      <Box style={createPlanInteractionEscStyle(args.theme)}>
        <Text variant="meta">ESC</Text>
      </Box>
      <TextButton
        appearance="primary"
        label={args.submitLabel}
        disabled={!args.canSubmit}
        onPress={args.handleSubmit}
      />
    </Box>
  );
}

function renderOtherInput(args: {
  card: PlanInteractionMockCard;
  handleOtherTextChange: (value: string) => void;
  otherText: string;
  selectedOptionId: string | null;
  theme: Theme;
}): React.JSX.Element | null {
  const option = selectedOption(args.card, args.selectedOptionId);
  if (option?.kind !== "other") {
    return null;
  }
  return (
    <Box style={createPlanInteractionInlineInputStyle(args.theme)}>
      <TextField
        accessibilityLabel="Tell Codex what to do differently"
        appearance="plain"
        onChangeText={args.handleOtherTextChange}
        placeholder="Tell Codex what to do differently"
        value={args.otherText}
      />
    </Box>
  );
}

function SessionComposerPlanInteractionSurface({
  actions,
  card,
  canSubmit,
  otherText,
  selectedOptionId,
}: SessionComposerPlanInteractionSurfaceProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const handleDismissInteraction = actions.dismissInteraction;
  const handleSubmit = resolveSubmitHandler({ actions, canSubmit });

  return (
    <Box gap="sm">
      <Box style={createPlanInteractionHeaderStyle()}>
        <Text variant="panelHeading">{card.prompt}</Text>
        {card.stepLabel !== null && (
          <Text variant="rowLabelMuted">{card.stepLabel}</Text>
        )}
      </Box>
      {renderOptionRows({
        card,
        onSelectOption: actions.selectOption,
        selectedOptionId,
      })}
      {renderOtherInput({
        card,
        handleOtherTextChange: actions.setOtherText,
        otherText,
        selectedOptionId,
        theme,
      })}
      {renderActionRows({
        canSubmit,
        handleDismissInteraction,
        handleSubmit,
        submitLabel: card.submitLabel,
        theme,
      })}
    </Box>
  );
}
export { SessionComposerPlanInteractionSurface };
