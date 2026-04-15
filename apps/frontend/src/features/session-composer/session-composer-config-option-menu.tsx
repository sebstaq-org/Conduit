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

function flattenOptionValues(option: SessionConfigOption): SessionConfigOptionValue[] {
  const values: SessionConfigOptionValue[] = [];
  for (const entry of option.options) {
    if ("group" in entry && Array.isArray(entry.options)) {
      for (const groupedOption of entry.options as Array<{
        name: string;
        value: string;
      }>) {
        if (
          typeof groupedOption.name !== "string" ||
          typeof groupedOption.value !== "string"
        ) {
          continue;
        }
        values.push({
          name: groupedOption.name,
          value: groupedOption.value,
        });
      }
      continue;
    }
    if (typeof entry.name !== "string" || typeof entry.value !== "string") {
      continue;
    }
    values.push({
      name: entry.name,
      value: entry.value,
    });
  }
  return values;
}

function optionControlLabel(option: SessionConfigOption): string {
  return `${option.name}: ${String(option.currentValue)}`;
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
            key={`${option.id}:${String(value.value)}`}
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
