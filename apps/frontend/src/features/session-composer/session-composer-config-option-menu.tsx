import type {
  SessionConfigOption,
  SessionConfigOptionEntry,
  SessionConfigOptionValue,
} from "@/app-state/models";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@/ui";
import { SessionComposerPreviewControlChip } from "./session-composer-control";

interface SessionComposerConfigOptionMenuProps {
  disabled: boolean;
  onSelect: (configId: string, value: string) => void;
  option: SessionConfigOption;
}

function flattenOptionEntry(
  entry: SessionConfigOptionEntry,
): SessionConfigOptionValue[] {
  if (entry.kind === "group") {
    return entry.options;
  }
  return [entry];
}

function flattenOptionValues(
  option: SessionConfigOption,
): SessionConfigOptionValue[] {
  return option.options.flatMap((entry) => flattenOptionEntry(entry));
}

function optionCurrentValueLabel(value: string): string {
  return value;
}

function optionControlLabel(option: SessionConfigOption): string {
  return `${option.name}: ${optionCurrentValueLabel(option.currentValue)}`;
}

function SessionComposerConfigOptionMenu({
  disabled,
  onSelect,
  option,
}: SessionComposerConfigOptionMenuProps): React.JSX.Element {
  const values = flattenOptionValues(option);
  if (values.length === 0) {
    return (
      <SessionComposerPreviewControlChip
        control={{ label: option.name, value: optionControlLabel(option) }}
        showChevron={false}
      />
    );
  }
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        accessibilityLabel={`Select ${option.name}`}
        disabled={disabled}
      >
        <SessionComposerPreviewControlChip
          control={{ label: option.name, value: optionControlLabel(option) }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {values.map((value) => (
          <DropdownMenuItem
            key={`${option.id}:${value.value}`}
            label={value.name}
            onSelect={() => {
              onSelect(option.id, value.value);
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

export { SessionComposerConfigOptionMenu };
