import { expect, test } from "@playwright/test";
import { startDesktopE2eHarness } from "../src/desktopHarness.js";
import type { Page } from "@playwright/test";

const recoveryLastExitPattern = /spawn failed|exited code=-2 signal=null/iu;

function desktopPairingTrigger(page: Page) {
  return page.locator('[aria-label="Mobile pairing controls"]');
}

test("sandboxed desktop exposes preload bridge and recovery state", async () => {
  const harness = await startDesktopE2eHarness({
    sandboxMode: "enabled",
    serviceBinPath: "/tmp/conduit-missing-service-bin",
  });
  try {
    const page = harness.page;
    await expect(desktopPairingTrigger(page)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.evaluate(() => ({
        hasDesktopBridge:
          typeof (
            globalThis as unknown as {
              conduitDesktop?: unknown;
            }
          ).conduitDesktop !== "undefined",
        hasRuntimeConfig:
          typeof (
            globalThis as unknown as {
              CONDUIT_RUNTIME_CONFIG?: unknown;
            }
          ).CONDUIT_RUNTIME_CONFIG !== "undefined",
      })),
    ).resolves.toEqual({
      hasDesktopBridge: true,
      hasRuntimeConfig: true,
    });
    await desktopPairingTrigger(page).click();
    await expect(page.getByText("Desktop needs attention")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Restart daemon" }),
    ).toBeVisible();
    await expect(readDesktopStatus(page)).resolves.toMatchObject({
      backendHealthy: false,
      lastExit: expect.stringMatching(recoveryLastExitPattern),
      running: false,
    });
  } finally {
    await harness.stop();
  }
});

async function readDesktopStatus(page: Page): Promise<{
  readonly backendHealthy: boolean;
  readonly lastExit: string | null;
  readonly running: boolean;
}> {
  return await page.evaluate(
    async () =>
      await (
        globalThis as unknown as {
          conduitDesktop: {
            getDaemonStatus(): Promise<{
              readonly backendHealthy: boolean;
              readonly lastExit: string | null;
              readonly running: boolean;
            }>;
          };
        }
      ).conduitDesktop.getDaemonStatus(),
  );
}
