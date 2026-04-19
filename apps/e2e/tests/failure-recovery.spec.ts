import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const providers = ["codex", "claude", "copilot"] as const;
const failureRecoveryFixtureRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "provider-scenarios",
  "failure-recovery",
);

let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startE2eHarness({ fixtureRoot: failureRecoveryFixtureRoot });
});

test.afterAll(async () => {
  await harness?.stop();
});

for (const provider of providers) {
  test(`listed ${provider} session load failure keeps UI usable`, async ({
    page,
  }) => {
    const activeHarness = requireHarness();
    await activeHarness.addProject(fixtureCwd);
    await openFrontend(page, activeHarness);

    await openListedSession(
      page,
      activeHarness,
      `${titleCase(provider)} load failure session`,
    );

    await expect(page.getByText("Session failed to open")).toBeVisible();
    await expect(page.getByText("Select a session")).toBeVisible();

    await openListedSession(
      page,
      activeHarness,
      `${titleCase(provider)} recovery session`,
    );

    await expect(
      page.getByText(`CONDUIT_E2E_RECOVERY_TRANSCRIPT_${provider}`),
    ).toBeVisible();
    await expect(page.getByText("Session failed to open")).not.toBeVisible();
  });

  test(`draft ${provider} prompt failure preserves draft`, async ({ page }) => {
    const activeHarness = requireHarness();
    const draftText = `CONDUIT_E2E_PROMPT_FAILURE_DRAFT_${provider}`;
    await activeHarness.addProject(fixtureCwd);
    await openFrontend(page, activeHarness);

    const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
    await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
    await newSessionButton.click();
    await page.getByLabel("Select provider for new session").click();
    await page.getByRole("menuitem", { name: provider }).click();

    const messageInput = page.getByLabel("Session message");
    await messageInput.fill(draftText);
    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText("Request failed")).toBeVisible();
    await expect(messageInput).toHaveValue(draftText);
    await expect(messageInput).toBeEditable();
    await expect(sendButton).toBeEnabled();
  });
}

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
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

async function openListedSession(
  page: Page,
  activeHarness: E2eHarness,
  title: string,
): Promise<void> {
  const sessionRow = page.getByRole("button", { name: title });
  await expectVisibleWithDiagnostics(page, activeHarness, sessionRow);
  await sessionRow.click();
}

async function expectVisibleWithDiagnostics(
  page: Page,
  activeHarness: E2eHarness,
  locator: Locator,
): Promise<void> {
  try {
    await expect(locator).toBeVisible();
  } catch (error) {
    throw new Error(
      `${String(error)}\n\nE2E diagnostics:\n${await pageDiagnostics(page, activeHarness)}`,
    );
  }
}

async function pageDiagnostics(
  page: Page,
  activeHarness: E2eHarness,
): Promise<string> {
  const bodyText = await page.locator("body").innerText({ timeout: 1_000 });
  return JSON.stringify(
    {
      bodyText,
      sessionWsUrl: activeHarness.sessionWsUrl,
      url: page.url(),
    },
    null,
    2,
  );
}
