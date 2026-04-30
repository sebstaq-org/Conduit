import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import {
  relayBackedBrowserE2eCiSkipReason,
  relayBackedBrowserE2eRunsInRequiredCi,
} from "../src/ciRelayPolicy.js";
import {
  expectMobileNavigationPanelClosed,
  expectNoFailureFeedback,
  expectVisibleWithDiagnostics,
  fixtureSessionTitle,
  openMobileFrontend,
  openMobileNavigationPanel,
  pairFrontendFromPairRoute,
  transcriptSentinel,
} from "../src/sessionListTestUtils.js";
import type { E2eHarness } from "../src/harness.js";

let harness: E2eHarness | null = null;

test.skip(
  relayBackedBrowserE2eRunsInRequiredCi,
  relayBackedBrowserE2eCiSkipReason,
);

test.beforeAll(async () => {
  harness = await startE2eHarness({ exposeDirectSessionUrl: false });
});

test.afterAll(async () => {
  await harness?.stop();
});

test("mobile drawer closes immediately when an existing session is selected", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openMobileFrontend(page, activeHarness);
  await pairFrontendFromPairRoute(page, activeHarness);

  await openMobileNavigationPanel(page);
  const sessionRow = page.getByRole("button", { name: fixtureSessionTitle });
  await expectVisibleWithDiagnostics(page, activeHarness, sessionRow);
  await sessionRow.click();

  await expect(page.getByText(transcriptSentinel, { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await expectMobileNavigationPanelClosed(page);
  await expectNoFailureFeedback(page);
});

test("mobile drawer closes immediately when a draft session is selected", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openMobileFrontend(page, activeHarness);
  await pairFrontendFromPairRoute(page, activeHarness);

  await openMobileNavigationPanel(page);
  await page.getByLabel(`New session in ${fixtureCwd}`).click();

  await expect(
    page.getByLabel("Select provider for new session"),
  ).toBeVisible();
  await expectMobileNavigationPanelClosed(page);
  await expectNoFailureFeedback(page);
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}
