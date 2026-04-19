import type { CSSProperties } from "react";
import { useTheme } from "@shopify/restyle";
import { Toaster } from "burnt/web";
import type { Theme } from "@/theme";

type ToastStyle = CSSProperties & Record<`--${string}`, string>;

function createToastStyle(theme: Theme): ToastStyle {
  return {
    "--normal-bg": theme.colors.errorToastBackground,
    "--normal-border": theme.colors.errorToastBorder,
    "--normal-text": theme.colors.errorToastText,
    backgroundColor: theme.colors.errorToastBackground,
    borderColor: theme.colors.errorToastBorder,
    borderRadius: theme.borderRadii.panel,
    color: theme.colors.errorToastText,
  };
}

function ToastHost(): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Toaster
      closeButton
      expand
      position="bottom-right"
      toastOptions={{ style: createToastStyle(theme) }}
      visibleToasts={3}
    />
  );
}

export { ToastHost };
