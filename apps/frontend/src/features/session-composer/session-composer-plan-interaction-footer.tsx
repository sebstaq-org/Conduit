import { Box, Text } from "@/theme";
import { TextButton } from "@/ui";
import type { Theme } from "@/theme";
import type { PlanInteractionCard } from "@/app-state";
import {
  createPlanInteractionEscStyle,
  createPlanInteractionFooterStyle,
} from "./session-composer-plan-interaction.styles";

interface PlanInteractionActionRowsProps {
  canSubmit: boolean;
  card: PlanInteractionCard;
  hasOtherSelection: boolean;
  handleDismissInteraction: () => void;
  handleSubmit: (() => void) | undefined;
  submitLabel: string;
  theme: Theme;
}

function renderDismissControl(
  args: PlanInteractionActionRowsProps,
): React.JSX.Element {
  return (
    <>
      <TextButton
        appearance="secondary"
        label="Dismiss"
        onPress={args.handleDismissInteraction}
      />
      <Box style={createPlanInteractionEscStyle(args.theme)}>
        <Text variant="meta">ESC</Text>
      </Box>
    </>
  );
}

function renderDismiss(
  args: PlanInteractionActionRowsProps,
): React.JSX.Element {
  return (
    <Box style={createPlanInteractionFooterStyle()}>
      {renderDismissControl(args)}
    </Box>
  );
}

function renderSubmit(args: PlanInteractionActionRowsProps): React.JSX.Element {
  return (
    <TextButton
      appearance="primary"
      label={args.submitLabel}
      disabled={!args.canSubmit}
      onPress={args.handleSubmit}
    />
  );
}

function renderQuestionSubmit(
  args: PlanInteractionActionRowsProps,
): React.JSX.Element {
  return (
    <Box style={createPlanInteractionFooterStyle()}>
      {renderDismissControl(args)}
      {renderSubmit(args)}
    </Box>
  );
}

function renderTerminalSubmit(
  args: PlanInteractionActionRowsProps,
): React.JSX.Element | null {
  if (!args.hasOtherSelection) {
    return null;
  }
  return (
    <Box style={createPlanInteractionFooterStyle()}>{renderSubmit(args)}</Box>
  );
}

function renderPlanInteractionActionRows(
  args: PlanInteractionActionRowsProps,
): React.JSX.Element | null {
  if (args.card.kind === "terminal_decision") {
    return renderTerminalSubmit(args);
  }
  if (!args.hasOtherSelection) {
    return renderDismiss(args);
  }
  return renderQuestionSubmit(args);
}

export { renderPlanInteractionActionRows };
