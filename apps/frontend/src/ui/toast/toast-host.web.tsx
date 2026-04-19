import type { CSSProperties } from "react";
import { useTheme } from "@shopify/restyle";
import { Toaster } from "burnt/web";
import type { Theme } from "@/theme";

type ToastStyle = CSSProperties & Record<`--${string}`, string>;

function createToasterStyle(): ToastStyle {
  return {
    "--width": "484px",
  };
}

function createToastStyle(theme: Theme): ToastStyle {
  return {
    "--normal-bg": theme.colors.errorToastBackground,
    "--normal-border": theme.colors.errorToastBorder,
    "--normal-text": theme.colors.errorToastText,
    backgroundColor: theme.colors.errorToastBackground,
    borderColor: theme.colors.errorToastBorder,
    borderRadius: theme.borderRadii.none,
    color: theme.colors.errorToastText,
  };
}

function createToastLayoutCss(): string {
  return `
    [data-sonner-toaster] {
      max-width: calc(100vw - 24px);
    }

    [data-sonner-toast][data-styled='true'] {
      align-items: flex-start;
      box-shadow: 0 2px 5px rgba(24, 24, 24, 0.18);
      gap: 14px;
      min-height: 68px;
      padding: 15px 48px 15px 18px;
    }
  `;
}

function createToastIconCss(theme: Theme): string {
  return `
    [data-sonner-toast][data-styled='true'] [data-icon] {
      align-items: center;
      background: ${theme.colors.errorToastIconBackground};
      border-radius: 999px;
      color: #ffffff;
      height: 18px;
      justify-content: center;
      margin: 1px 4px 0 0;
      position: relative;
      width: 18px;
    }

    [data-sonner-toast][data-styled='true'] [data-icon] svg {
      display: none;
    }

    [data-sonner-toast][data-styled='true'] [data-icon]::before,
    [data-sonner-toast][data-styled='true'] [data-icon]::after {
      background: #ffffff;
      border-radius: 999px;
      content: "";
      height: 2px;
      left: 5px;
      position: absolute;
      top: 8px;
      width: 8px;
    }

    [data-sonner-toast][data-styled='true'] [data-icon]::before {
      transform: rotate(45deg);
    }

    [data-sonner-toast][data-styled='true'] [data-icon]::after {
      transform: rotate(-45deg);
    }
  `;
}

function createToastTextCss(theme: Theme): string {
  return `
    [data-sonner-toast][data-styled='true'] [data-content] {
      gap: 3px;
    }

    [data-sonner-toast][data-styled='true'] [data-title] {
      color: ${theme.colors.errorToastTitle};
      font-size: 14px;
      font-weight: 700;
      line-height: 18px;
    }

    [data-sonner-toast][data-styled='true'] [data-description] {
      color: ${theme.colors.errorToastText};
      font-size: 13px;
      line-height: 17px;
    }
  `;
}

function createToastCloseCss(theme: Theme): string {
  return `
    [data-sonner-toast][data-styled='true'] [data-close-button] {
      background: transparent;
      border: 0;
      color: ${theme.colors.errorToastClose};
      height: 28px;
      left: auto;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
    }

    [data-sonner-toast][data-styled='true'] [data-close-button] svg {
      height: 18px;
      width: 18px;
    }

    [data-sonner-toast][data-styled='true']:hover [data-close-button]:hover {
      background: transparent;
      color: ${theme.colors.errorToastText};
    }
  `;
}

function createToastCss(theme: Theme): string {
  return [
    createToastLayoutCss(),
    createToastIconCss(theme),
    createToastTextCss(theme),
    createToastCloseCss(theme),
  ].join("\n");
}

function ToastHost(): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <>
      <style>{createToastCss(theme)}</style>
      <Toaster
        closeButton
        expand
        gap={8}
        offset={12}
        position="bottom-right"
        style={createToasterStyle()}
        toastOptions={{ style: createToastStyle(theme) }}
        visibleToasts={3}
      />
    </>
  );
}

export { ToastHost };
