import { toast } from "burnt";
import type { ErrorToastOptions } from "./toast.types";

// Burnt Android multiplies duration by 1000 before passing it to
// ToastAndroid, which expects SHORT/LONG constants rather than milliseconds.
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
