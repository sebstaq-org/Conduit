import { createBox, createText } from "@shopify/restyle";
import type { Theme } from "./theme";

const Box = createBox<Theme>();
const Text = createText<Theme>();

export { Box, Text };
