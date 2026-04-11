import { ConduitStoreProvider } from "@/app-state";
import { RootLayoutTheme } from "./root-layout-theme";

function RootLayoutStore(): React.JSX.Element {
  return (
    <ConduitStoreProvider>
      <RootLayoutTheme />
    </ConduitStoreProvider>
  );
}

export { RootLayoutStore };
