import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const defaultPrompt = "Reply with exactly fixture-ready.";
const defaultSentinel = "fixture-ready";

let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startE2eHarness();
});

test.afterAll(async () => {
  await harness?.stop();
});

test("new default session appears in sidebar from draft", async ({ page }) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expect(newSessionButton).toBeVisible();
  await newSessionButton.click();

  await expect(page.getByText("Draft session")).toBeVisible();
  await expect(page.getByText("No provider selected")).toBeVisible();

  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("codex").click();
  await expect(page.getByText("No provider selected")).not.toBeVisible();
  await expect(page.getByLabel("Provider", { exact: true })).toHaveText(
    "codex",
  );

  await page.getByLabel("Session message").fill(defaultPrompt);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.getByText("Draft session")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Untitled session" }),
  ).toBeVisible();
  await expect(page.getByText(defaultSentinel, { exact: true })).toBeVisible();
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
