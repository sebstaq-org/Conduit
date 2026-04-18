import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const fixtureSessionTitle = "Conduit E2E fixture session";
const newSessionPrompt =
  "Reply with exactly CONDUIT_E2E_SENTINEL_SESSION_NEW_PROMPT.";
const newSessionSentinel = "CONDUIT_E2E_SENTINEL_SESSION_NEW_PROMPT";
const transcriptSentinel = "CONDUIT_E2E_SENTINEL_SESSION_LOAD_TRANSCRIPT";

let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startE2eHarness();
});

test.afterAll(async () => {
  await harness?.stop();
});

test("session list opens fixture transcript", async ({ page }) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  const sessionRow = page.getByRole("button", { name: fixtureSessionTitle });
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();

  await expect(page.getByText(transcriptSentinel)).toBeVisible();
});

test("draft prompt creates fixture session", async ({ page }) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  await page.getByLabel(`New session in ${fixtureCwd}`).click();
  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("codex").click();
  await page.getByLabel("Session message").fill(newSessionPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.getByLabel("Session message")).toHaveValue("");
  await expect(
    page.getByText(newSessionSentinel, { exact: true }),
  ).toBeVisible();
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}

async function openFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await page.addInitScript((sessionWsUrl) => {
    (
      globalThis as {
        CONDUIT_RUNTIME_CONFIG?: { sessionWsUrl: string };
      }
    ).CONDUIT_RUNTIME_CONFIG = { sessionWsUrl };
  }, activeHarness.sessionWsUrl);
  await page.goto(activeHarness.frontendUrl);
}
