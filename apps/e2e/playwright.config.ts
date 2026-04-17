import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = existsSync("/snap/bin/chromium")
  ? "/snap/bin/chromium"
  : undefined;
const chromiumExecutablePath =
  process.env.CONDUIT_CHROMIUM_BIN ?? systemChromium;

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
  timeout: 90_000,
  use: {
    launchOptions: {
      ...(chromiumExecutablePath === undefined
        ? {}
        : { executablePath: chromiumExecutablePath }),
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: 1,
});
