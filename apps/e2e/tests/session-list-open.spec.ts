import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const fixtureSessionTitle = "Conduit E2E fixture session";
const transcriptSentinel = "CONDUIT_E2E_SENTINEL_SESSION_LOAD_TRANSCRIPT";

let harness: E2eHarness;

test.beforeAll(async () => {
  harness = await startE2eHarness();
});

test.afterAll(async () => {
  await harness.stop();
});

test("session list opens fixture transcript", async ({ page }) => {
  await harness.addProject(fixtureCwd);
  await page.goto(harness.frontendUrl);

  const sessionRow = page.getByRole("button", { name: fixtureSessionTitle });
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();

  await expect(page.getByText(transcriptSentinel)).toBeVisible();
});
