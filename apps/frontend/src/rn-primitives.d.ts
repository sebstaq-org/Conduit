/* eslint-disable import/group-exports */
import type { ComponentType, ReactNode } from "react";

interface RNPrimitivePopoverRootContext {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RNPrimitivePopoverProps {
  children?: ReactNode;
  [key: string]: unknown;
}

declare module "@rn-primitives/popover" {
  const Content: ComponentType<RNPrimitivePopoverProps>;
  const Close: ComponentType<RNPrimitivePopoverProps>;
  const Overlay: ComponentType<RNPrimitivePopoverProps>;
  const Portal: ComponentType<RNPrimitivePopoverProps>;
  const Root: ComponentType<RNPrimitivePopoverProps>;
  const Trigger: ComponentType<RNPrimitivePopoverProps>;
  function useRootContext(): RNPrimitivePopoverRootContext;

  export { Content, Close, Overlay, Portal, Root, Trigger, useRootContext };
}

declare module "@rn-primitives/portal" {
  const PortalHost: ComponentType<RNPrimitivePopoverProps>;

  export { PortalHost };
}
