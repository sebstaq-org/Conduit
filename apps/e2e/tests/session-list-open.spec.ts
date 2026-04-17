import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const fixtureSessionTitle = "Conduit E2E fixture session";
const newSessionPrompt =
  "Reply with exactly CONDUIT_E2E_SENTINEL_SESSION_NEW_PROMPT.";
const newSessionSentinel = "CONDUIT_E2E_SENTINEL_SESSION_NEW_PROMPT";
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

test("draft prompt creates fixture session", async ({ page }) => {
  await harness.addProject(fixtureCwd);
  await page.goto(harness.frontendUrl);

  await page.getByLabel(`New session in ${fixtureCwd}`).click();
  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("codex").click();
  await page.getByLabel("Session message").fill(newSessionPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.getByLabel("Session message")).toHaveValue("");
  await expect(page.getByText(newSessionSentinel, { exact: true })).toBeVisible();
});
