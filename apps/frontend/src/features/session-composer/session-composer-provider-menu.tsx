import { PROVIDERS } from "@conduit/session-client";
import type { ProviderId } from "@conduit/session-client";
import { MenuContent, MenuItem, usePopoverControls } from "@/ui";

interface SessionComposerProviderMenuProps {
  onProviderSelect: (provider: ProviderId) => void;
}

function SessionComposerProviderMenu({
  onProviderSelect,
}: SessionComposerProviderMenuProps): React.JSX.Element {
  const { close } = usePopoverControls();

  return (
    <MenuContent>
      {PROVIDERS.map((provider) => (
        <MenuItem
          key={provider}
          label={provider}
          onSelect={() => {
            onProviderSelect(provider);
            close();
          }}
        />
      ))}
    </MenuContent>
  );
}

export { SessionComposerProviderMenu };
