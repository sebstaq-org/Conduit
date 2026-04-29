type KeyboardLiftPlatform =
  | "android"
  | "ios"
  | "macos"
  | "native"
  | "web"
  | "windows";
type KeyboardLiftMode = "avoid" | "plain";

function keyboardLiftMode(platform: KeyboardLiftPlatform): KeyboardLiftMode {
  if (platform === "android" || platform === "ios") {
    return "avoid";
  }
  return "plain";
}

export { keyboardLiftMode };
export type { KeyboardLiftMode, KeyboardLiftPlatform };
