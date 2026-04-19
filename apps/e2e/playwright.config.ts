import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = existsSync("/snap/bin/chromium")
  ? "/snap/bin/chromium"
  : undefined;
const chromiumExecutablePath =
  process.env.CONDUIT_CHROMIUM_BIN ?? systemChromium;
const videoMode =
  process.env.CONDUIT_E2E_RECORD_VIDEO === "1" ? "on" : "retain-on-failure";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: process.env.CI === "true" ? "list" : "line",
  testDir: "./tests",
  timeout: 240_000,
  use: {
    launchOptions: {
      ...(chromiumExecutablePath === undefined
        ? {}
        : { executablePath: chromiumExecutablePath }),
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: videoMode,
  },
  workers: 1,
});
