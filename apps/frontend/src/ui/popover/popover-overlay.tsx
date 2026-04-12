import { Overlay } from "@rn-primitives/popover";
import { createPopoverOverlayStyle } from "./popover.styles";

function PopoverOverlay(): React.JSX.Element {
  return <Overlay closeOnPress style={createPopoverOverlayStyle()} />;
}

export { PopoverOverlay };
