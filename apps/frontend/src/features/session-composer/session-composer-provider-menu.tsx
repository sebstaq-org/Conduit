import { PROVIDERS } from "@conduit/session-client";
import type { ProviderId } from "@conduit/session-client";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/ui";
import { displayProviderName } from "./session-composer-display";

interface SessionComposerProviderMenuProps {
  onProviderSelect: (provider: ProviderId) => void;
}

function SessionComposerProviderMenu({
  onProviderSelect,
}: SessionComposerProviderMenuProps): React.JSX.Element {
  return (
    <DropdownMenuPortal>
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
    </DropdownMenuPortal>
  );
}

export { SessionComposerProviderMenu };
