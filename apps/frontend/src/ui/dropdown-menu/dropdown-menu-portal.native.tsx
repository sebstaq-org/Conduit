import { Overlay, Portal } from "@rn-primitives/dropdown-menu";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

interface DropdownMenuPortalProps {
  readonly children: ReactNode;
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});

function DropdownMenuPortal({
  children,
}: DropdownMenuPortalProps): React.JSX.Element {
  return (
    <Portal>
      <Overlay style={styles.overlay} />
      {children}
    </Portal>
  );
}

export { DropdownMenuPortal };
