import type { ReactNode } from "react";
import { View } from "react-native";
import { listStyles } from "./list.styles";

interface ListProps {
  children: ReactNode;
}

function List({ children }: ListProps): React.JSX.Element {
  return <View style={listStyles.list}>{children}</View>;
}

export { List };
