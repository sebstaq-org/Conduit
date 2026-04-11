import type { ReactNode } from "react";
import { ThemeProvider } from "@shopify/restyle";
import { darkTheme, lightTheme } from "./theme";
import type { ThemeMode } from "./theme";

interface ConduitThemeProviderProps {
  children: ReactNode;
  mode?: ThemeMode | undefined;
}

const themes = {
  dark: darkTheme,
  light: lightTheme,
};

function ConduitThemeProvider({
  children,
  mode = "light",
}: ConduitThemeProviderProps): React.JSX.Element {
  return <ThemeProvider theme={themes[mode]}>{children}</ThemeProvider>;
}

export { ConduitThemeProvider };
