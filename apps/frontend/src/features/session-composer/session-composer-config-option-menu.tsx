import type { SessionConfigOption } from "@conduit/session-client";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@/ui";
import { SessionComposerPreviewControlChip } from "./session-composer-control";

interface SessionConfigOptionValue {
  name: string;
  value: string;
}

interface SessionComposerConfigOptionMenuProps {
  disabled: boolean;
  onSelect: (configId: string, value: string) => void;
  option: SessionConfigOption;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionValue(value: unknown): SessionConfigOptionValue | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.name !== "string") {
    return null;
  }
  if (typeof value.value !== "string") {
    return null;
  }
  return { name: value.name, value: value.value };
}

function optionGroupEntries(value: unknown): unknown[] {
  if (
    !isRecord(value) ||
    !("group" in value) ||
    !Array.isArray(value.options)
  ) {
    return [];
  }
  return value.options;
}

function collectGroupedOptionValues(
  value: unknown,
): SessionConfigOptionValue[] {
  const entries = optionGroupEntries(value);
  const grouped: SessionConfigOptionValue[] = [];
  for (const entry of entries) {
    const optionValue = toOptionValue(entry);
    if (optionValue !== null) {
      grouped.push(optionValue);
    }
  }
  return grouped;
}

function flattenOptionValues(
  option: SessionConfigOption,
): SessionConfigOptionValue[] {
  const values: SessionConfigOptionValue[] = [];
  for (const entry of option.options) {
    const groupedValues = collectGroupedOptionValues(entry);
    if (groupedValues.length > 0) {
      for (const groupedValue of groupedValues) {
        values.push(groupedValue);
      }
    } else {
      const optionValue = toOptionValue(entry);
      if (optionValue !== null) {
        values.push(optionValue);
      }
    }
  }
  return values;
}

function optionControlLabel(option: SessionConfigOption): string {
  return `${option.name}: ${option.currentValue}`;
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
