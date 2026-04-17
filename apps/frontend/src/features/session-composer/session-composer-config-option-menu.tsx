import type { SessionConfigOption } from "@conduit/session-client";
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

function optionControlLabel(option: SessionConfigOption): string {
  return `${option.name}: ${option.currentValue}`;
}

function SessionComposerConfigOptionMenu({
  disabled,
  onSelect,
  option,
}: SessionComposerConfigOptionMenuProps): React.JSX.Element {
  const values = option.values;
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
