import { Portal } from "@rn-primitives/portal";
import type { ReactNode } from "react";
import { modalPortalName } from "./modal-portal-name";

interface ModalPortalProps {
  children: ReactNode;
}

function ModalPortal({ children }: ModalPortalProps): React.JSX.Element {
  return (
    <Portal name={modalPortalName}>
      {/* oxlint-disable-next-line react/jsx-no-useless-fragment -- Portal calls React.Children.only on web. */}
      <>{children}</>
    </Portal>
  );
}

export { ModalPortal };
