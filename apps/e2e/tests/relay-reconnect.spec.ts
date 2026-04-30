import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import {
  closePopover,
  expectMobileNavigationPanelClosed,
  expectNoFailureFeedback,
  expectVisibleWithDiagnostics,
  fixtureSessionTitle,
  openFrontend,
  openHostPairingPopover,
  openMobileFrontend,
  openMobileNavigationPanel,
  pairFrontend,
  pairFrontendFromPairRoute,
  transcriptSentinel,
} from "../src/sessionListTestUtils.js";
import type { E2eHarness } from "../src/harness.js";

let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startE2eHarness({ exposeDirectSessionUrl: false });
});

test.afterAll(async () => {
  await harness?.stop();
});

test("mobile app restart preserves pairing and reconnects after relay drop", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openMobileFrontend(page, activeHarness);
  await pairFrontendFromPairRoute(page, activeHarness);

  const context = page.context();
  await page.close();
  const restartedPage = await context.newPage();
  try {
    await openMobileFrontend(restartedPage, activeHarness);
    await openHostPairingPopover(restartedPage);
    await expect(
      restartedPage.getByLabel("Desktop connected indicator"),
    ).toBeVisible({ timeout: 15000 });
    await closePopover(restartedPage);
    await openMobileNavigationPanel(restartedPage);
    await expectVisibleWithDiagnostics(
      restartedPage,
      activeHarness,
      restartedPage.getByRole("button", { name: fixtureSessionTitle }),
    );

    const beforeReconnect = await activeHarness.relaySnapshot();
    await activeHarness.closeRelayDataSocket();
    await expect
      .poll(async () => (await activeHarness.relaySnapshot()).dataSocketCount, {
        timeout: 15000,
      })
      .toBeGreaterThan(beforeReconnect.dataSocketCount);

    await restartedPage
      .getByRole("button", { name: fixtureSessionTitle })
      .click();
    await expect(
      restartedPage.getByText(transcriptSentinel, { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expectMobileNavigationPanelClosed(restartedPage);
    await expectNoFailureFeedback(restartedPage);
  } finally {
    await restartedPage.close().catch(() => undefined);
  }
});

test("pairing UI drives session commands through relay and reconnects", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await expect(
    page.getByRole("button", { name: "Desktop connection controls" }),
  ).toBeVisible();
  await openHostPairingPopover(page);
  await expect(page.getByLabel("Desktop idle indicator")).toBeVisible();
  await expect(page.getByText("No desktop paired")).toBeVisible();
  await pairFrontend(page, activeHarness);

  const beforeReconnect = await activeHarness.relaySnapshot();
  expect(beforeReconnect.controlSocketCount).toBeGreaterThanOrEqual(1);
  expect(beforeReconnect.clientSocketCount).toBeGreaterThanOrEqual(1);
  expect(beforeReconnect.dataSocketCount).toBeGreaterThanOrEqual(1);
  expect(beforeReconnect.clientMessageCount).toBeGreaterThanOrEqual(1);
  expect(beforeReconnect.dataMessageCount).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(beforeReconnect)).not.toContain("settings/get");
  expect(JSON.stringify(beforeReconnect)).not.toContain("sessions/grouped");

  await activeHarness.closeRelayDataSocket();
  await expect
    .poll(async () => (await activeHarness.relaySnapshot()).dataSocketCount, {
      timeout: 15000,
    })
    .toBeGreaterThan(beforeReconnect.dataSocketCount);
  await page.getByRole("button", { name: fixtureSessionTitle }).click();
  await expect(page.getByText(transcriptSentinel)).toBeVisible({
    timeout: 15000,
  });
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}
