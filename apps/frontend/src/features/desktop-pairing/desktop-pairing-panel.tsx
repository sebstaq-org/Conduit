import {
  desktopBridge,
  desktopBridgeAvailable,
} from "@/app-state/desktop-bridge";
import { DesktopPairingContent } from "./desktop-pairing-content";
import { useDesktopPairingState } from "./desktop-pairing-state";

function DesktopPairingPanel(): React.JSX.Element | null {
  const bridge = desktopBridge();
  const state = useDesktopPairingState(bridge);

  if (!desktopBridgeAvailable() || bridge === null) {
    return null;
  }
  return <DesktopPairingContent state={state} />;
}

export { DesktopPairingPanel };
