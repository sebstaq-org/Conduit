import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import {
  relayBackedBrowserE2eCiSkipReason,
  relayBackedBrowserE2eRunsInRequiredCi,
} from "../src/ciRelayPolicy.js";
import {
  closePopover,
  fixtureSessionTitle,
  offerFragmentValue,
  openFrontend,
  openHostPairingPopover,
  pairFrontendWithUrl,
  submitPairingUrl,
  tamperRelayEndpoint,
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

test("pairing survives reload, reconfigures, and forget clears stale data", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  const pairingUrl = await activeHarness.pairingUrl();
  await pairFrontendWithUrl(page, pairingUrl);
  await expect(page.getByText(fixtureCwd)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Desktop connection controls" }),
  ).toBeVisible();
  await openHostPairingPopover(page);
  await expect(page.getByLabel("Desktop connected indicator")).toBeVisible();
  await closePopover(page);
  await expect(page.getByText(fixtureCwd)).toBeVisible();

  await openHostPairingPopover(page);
  await submitPairingUrl(page, tamperRelayEndpoint(pairingUrl));
  await expect(
    page.getByText(/relay websocket failed to connect/u).first(),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Desktop disconnected indicator")).toBeVisible();

  await pairFrontendWithUrl(page, await activeHarness.pairingUrl());
  await openHostPairingPopover(page);
  await page.getByRole("button", { name: "Forget desktop" }).click();
  await expect(page.getByText("No desktop paired")).toBeVisible();
  await expect(page.getByLabel("Desktop idle indicator")).toBeVisible();
  await closePopover(page);
  await expect(page.getByLabel(`New session in ${fixtureCwd}`)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: fixtureSessionTitle }),
  ).toHaveCount(0);
});

test("pair route refreshes the offer field for a new deep link", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  const firstOffer = offerFragmentValue(await activeHarness.pairingUrl());
  const secondOffer = offerFragmentValue(await activeHarness.pairingUrl());

  await page.goto(`${activeHarness.frontendUrl}/pair?offer=${firstOffer}`);
  await expect(page.getByLabel("Pairing link")).toHaveValue(
    `conduit://pair?offer=${firstOffer}`,
  );
  await page.goto(`${activeHarness.frontendUrl}/pair?offer=${secondOffer}`);
  await expect(page.getByLabel("Pairing link")).toHaveValue(
    `conduit://pair?offer=${secondOffer}`,
  );
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}
