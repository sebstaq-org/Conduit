import { Text } from "react-native";
import { metaStyles } from "./meta.styles";

interface MetaProps {
  children: string;
}

function Meta({ children }: MetaProps): React.JSX.Element {
  return <Text style={metaStyles.text}>{children}</Text>;
}

export { Meta };
