import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { TextButton, TextField } from "@/ui";
import type {
  PlanInteractionCard,
  PlanInteractionOption,
  SessionComposerPlanInteractionActions,
} from "@/app-state";
import {
  createPlanInteractionEscStyle,
  createPlanInteractionFooterStyle,
  createPlanInteractionHeaderStyle,
  createPlanInteractionInlineInputStyle,
  createPlanInteractionTerminalOtherInputStyle,
  createPlanInteractionTerminalOtherRowStyle,
  createPlanInteractionTerminalPrefixStyle,
} from "./session-composer-plan-interaction.styles";

interface SessionComposerPlanInteractionSurfaceProps {
  actions: SessionComposerPlanInteractionActions;
  card: PlanInteractionCard;
  canSubmit: boolean;
  otherText: string;
  selectedOptionId: string | null;
}

function optionLabel(index: number, option: PlanInteractionOption): string {
  return `${index + 1}. ${option.label}`;
}

function selectedOption(
  card: PlanInteractionCard,
  selectedOptionId: string | null,
): PlanInteractionOption | null {
  if (selectedOptionId === null) {
    return null;
  }
  return (
    card.options.find((option) => option.optionId === selectedOptionId) ?? null
  );
}

function resolveSubmitHandler(args: {
  actions: SessionComposerPlanInteractionActions;
  canSubmit: boolean;
}): (() => void) | undefined {
  if (!args.canSubmit) {
    return undefined;
  }
  return args.actions.submitInteraction;
}

function createChoiceSubmitHandler(args: {
  actions: SessionComposerPlanInteractionActions;
}): (optionId: string) => void {
  return (optionId: string): void => {
    args.actions.submitChoice(optionId);
  };
}

function renderQuestionOptionRows(args: {
  card: PlanInteractionCard;
  onSelectOption: (optionId: string) => void;
  onSubmitChoice: (optionId: string) => void;
  selectedOptionId: string | null;
}): React.JSX.Element {
  return (
    <Box gap="xs">
      {args.card.options.map((option, index) => (
        <TextButton
          key={option.optionId}
          label={optionLabel(index, option)}
          onPress={() => {
            if (option.kind === "other") {
              args.onSelectOption(option.optionId);
              return;
            }
            args.onSubmitChoice(option.optionId);
          }}
          selected={option.optionId === args.selectedOptionId}
        />
      ))}
    </Box>
  );
}

function renderTerminalOtherOptionRow(args: {
  handleOtherTextChange: (value: string) => void;
  handleSubmit: (() => void) | undefined;
  index: number;
  otherText: string;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Box style={createPlanInteractionTerminalOtherRowStyle(args.theme)}>
      <Text style={createPlanInteractionTerminalPrefixStyle()} variant="rowLabel">
        {args.index + 1}.
      </Text>
      <Box style={createPlanInteractionTerminalOtherInputStyle()}>
        <TextField
          accessibilityLabel="Tell Codex what to do differently"
          appearance="plain"
          onChangeText={args.handleOtherTextChange}
          onSubmit={args.handleSubmit}
          placeholder="Tell Codex what to do differently"
          value={args.otherText}
        />
      </Box>
    </Box>
  );
}

function renderTerminalOptionRows(args: {
  card: PlanInteractionCard;
  handleOtherTextChange: (value: string) => void;
  handleSubmit: (() => void) | undefined;
  onSelectOption: (optionId: string) => void;
  onSubmitChoice: (optionId: string) => void;
  otherText: string;
  selectedOptionId: string | null;
  theme: Theme;
}): React.JSX.Element {
  return (
    <Box gap="xs">
      {args.card.options.map((option, index) => {
        if (option.kind === "other" && option.optionId === args.selectedOptionId) {
          return (
            <Box key={option.optionId}>
              {renderTerminalOtherOptionRow({
                handleOtherTextChange: args.handleOtherTextChange,
                handleSubmit: args.handleSubmit,
                index,
                otherText: args.otherText,
                theme: args.theme,
              })}
            </Box>
          );
        }
        return (
          <TextButton
            key={option.optionId}
            label={optionLabel(index, option)}
            onPress={() => {
              if (option.kind === "other") {
                args.onSelectOption(option.optionId);
                return;
              }
              args.onSubmitChoice(option.optionId);
            }}
            selected={option.optionId === args.selectedOptionId}
          />
        );
      })}
    </Box>
  );
}

function renderOptionRows(args: {
  card: PlanInteractionCard;
  handleOtherTextChange: (value: string) => void;
  handleSubmit: (() => void) | undefined;
  onSelectOption: (optionId: string) => void;
  onSubmitChoice: (optionId: string) => void;
  otherText: string;
  selectedOptionId: string | null;
  theme: Theme;
}): React.JSX.Element {
  if (args.card.kind === "terminal_decision") {
    return renderTerminalOptionRows(args);
  }
  return renderQuestionOptionRows(args);
}

function renderActionRows(args: {
  canSubmit: boolean;
  hasOtherSelection: boolean;
  handleDismissInteraction: () => void;
  handleSubmit: (() => void) | undefined;
  submitLabel: string;
  theme: Theme;
}): React.JSX.Element {
  if (!args.hasOtherSelection) {
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
      </Box>
    );
  }
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
  card: PlanInteractionCard;
  handleOtherTextChange: (value: string) => void;
  otherText: string;
  selectedOptionId: string | null;
  theme: Theme;
}): React.JSX.Element | null {
  const option = selectedOption(args.card, args.selectedOptionId);
  if (args.card.kind !== "question" || option?.kind !== "other") {
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

function isOtherSelection(
  card: PlanInteractionCard,
  selectedOptionId: string | null,
): boolean {
  const option = selectedOption(card, selectedOptionId);
  return option?.kind === "other";
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
  const hasOtherSelection = isOtherSelection(card, selectedOptionId);
  const handleSubmitChoice = createChoiceSubmitHandler({ actions });

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
        handleOtherTextChange: actions.setOtherText,
        handleSubmit,
        onSelectOption: actions.selectOption,
        onSubmitChoice: handleSubmitChoice,
        otherText,
        selectedOptionId,
        theme,
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
        hasOtherSelection,
        handleDismissInteraction,
        handleSubmit,
        submitLabel: card.submitLabel,
        theme,
      })}
    </Box>
  );
}
export { SessionComposerPlanInteractionSurface };
