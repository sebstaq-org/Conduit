import { toast } from "burnt";
import type { ErrorToastOptions } from "./toast.types";

const androidLongToastDurationSeconds = 0.001;

function showErrorToast({ title }: ErrorToastOptions): void {
  void toast({
    duration: androidLongToastDurationSeconds,
    from: "bottom",
    haptic: "error",
    preset: "error",
    title,
  });
}

export { showErrorToast };
