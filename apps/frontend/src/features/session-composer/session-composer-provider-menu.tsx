import { PROVIDERS } from "@conduit/session-client";
import type { ProviderId } from "@conduit/session-client";
import { DropdownMenuContent, DropdownMenuItem } from "@/ui";
import { displayProviderName } from "./session-composer-display";

interface SessionComposerProviderMenuProps {
  onProviderSelect: (provider: ProviderId) => void;
}

function SessionComposerProviderMenu({
  onProviderSelect,
}: SessionComposerProviderMenuProps): React.JSX.Element {
  return (
    <DropdownMenuContent>
      {PROVIDERS.map((provider) => (
        <DropdownMenuItem
          key={provider}
          label={displayProviderName(provider)}
          onSelect={() => {
            onProviderSelect(provider);
          }}
        />
      ))}
    </DropdownMenuContent>
  );
}

export { SessionComposerProviderMenu };
