import type { ReactNode } from "react";
import { Box } from "@/theme";
import { listGap } from "./list.styles";

interface ListProps {
  children: ReactNode;
}

function List({ children }: ListProps): React.JSX.Element {
  return <Box gap={listGap}>{children}</Box>;
}

export { List };
