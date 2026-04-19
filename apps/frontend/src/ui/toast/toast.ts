import { toast } from "burnt";
import type { ErrorToastOptions } from "./toast.types";

function showErrorToast({ message, title }: ErrorToastOptions): void {
  void toast({
    duration: 5,
    from: "bottom",
    haptic: "error",
    message,
    preset: "error",
    title,
  });
}

export { showErrorToast };
