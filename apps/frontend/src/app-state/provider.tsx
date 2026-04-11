import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "./store";

interface ConduitStoreProviderProps {
  children: ReactNode;
}

function ConduitStoreProvider({
  children,
}: ConduitStoreProviderProps): React.JSX.Element {
  return <Provider store={store}>{children}</Provider>;
}

export { ConduitStoreProvider };
