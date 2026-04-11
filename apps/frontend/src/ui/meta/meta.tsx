import { Text } from "@/theme";
import { metaTextVariant } from "./meta.styles";

interface MetaProps {
  children: string;
}

function Meta({ children }: MetaProps): React.JSX.Element {
  return <Text variant={metaTextVariant}>{children}</Text>;
}

export { Meta };
