import type { SessionConfigOption } from "@conduit/session-client";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@/ui";
import { SessionComposerPreviewControlChip } from "./session-composer-control";
import { displaySessionConfigOptionValue } from "./session-composer-display";

interface SessionComposerConfigOptionMenuProps {
  disabled: boolean;
  onSelect: (configId: string, value: string) => void;
  option: SessionConfigOption;
}

function renderConfigOptionItems({
  onSelect,
  option,
}: Pick<
  SessionComposerConfigOptionMenuProps,
  "onSelect" | "option"
>): React.JSX.Element[] {
  return option.values.map((value) => (
    <DropdownMenuItem
      key={`${option.id}:${value.value}`}
      label={value.name}
      onSelect={() => {
        onSelect(option.id, value.value);
      }}
    />
  ));
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
        control={{
          label: option.name,
          value: displaySessionConfigOptionValue(option),
        }}
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
          control={{
            label: option.name,
            value: displaySessionConfigOptionValue(option),
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent>
          {renderConfigOptionItems({ onSelect, option })}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
}

export { SessionComposerConfigOptionMenu };
