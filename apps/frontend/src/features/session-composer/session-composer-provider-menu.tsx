import { PROVIDERS } from "@/app-state/models";
import { DropdownMenuContent, DropdownMenuItem } from "@/ui";

interface SessionComposerProviderMenuProps {
  onProviderSelect: (provider: (typeof PROVIDERS)[number]) => void;
}

function SessionComposerProviderMenu({
  onProviderSelect,
}: SessionComposerProviderMenuProps): React.JSX.Element {
  return (
    <DropdownMenuContent>
      {PROVIDERS.map((provider) => (
        <DropdownMenuItem
          key={provider}
          label={provider}
          onSelect={() => {
            onProviderSelect(provider);
          }}
        />
      ))}
    </DropdownMenuContent>
  );
}

export { SessionComposerProviderMenu };
