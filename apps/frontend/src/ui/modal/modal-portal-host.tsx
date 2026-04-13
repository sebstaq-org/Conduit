import { PortalHost } from "@rn-primitives/portal";
import { StyleSheet, View } from "react-native";
import { modalPortalName } from "./modal-portal-name";

const styles = StyleSheet.create({
  host: {
    bottom: 0,
    elevation: 1100,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1100,
  },
});

function ModalPortalHost(): React.JSX.Element {
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <PortalHost name={modalPortalName} />
    </View>
  );
}

export { ModalPortalHost };
