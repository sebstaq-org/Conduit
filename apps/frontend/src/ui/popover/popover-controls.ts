import { useRootContext } from "@rn-primitives/popover";

function usePopoverControls(): {
  close: () => void;
  open: boolean;
} {
  const { onOpenChange, open } = useRootContext();

  return {
    close: () => {
      onOpenChange(false);
    },
    open,
  };
}

export { usePopoverControls };
