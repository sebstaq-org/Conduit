import { expect, test } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import {
  capturedTerminalPlanHeading,
  claudeParityPrompt,
  claudeParitySentinel,
  claudeParitySessionTitle,
  copilotParityPrompt,
  copilotParitySentinel,
  copilotParitySessionTitle,
  expectNoFailureFeedback,
  expectNoParityTranscript,
  expectParityTranscript,
  expectVisibleWithDiagnostics,
  fixtureSessionTitle,
  newSessionPrompt,
  openFrontend,
  openListedSession,
  pairFrontend,
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

test("session list opens fixture transcript", async ({ page }) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  await openListedSession(page, activeHarness, fixtureSessionTitle);

  await expect(page.getByText(transcriptSentinel)).toBeVisible();
  await expectNoFailureFeedback(page);
});

test("new session hides previously opened transcript and keeps draft context", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  await openListedSession(page, activeHarness, fixtureSessionTitle);
  await expect(
    page.getByText(transcriptSentinel, { exact: true }),
  ).toBeVisible();

  await page.getByLabel(`New session in ${fixtureCwd}`).click();
  await expect(
    page.getByLabel("Select provider for new session"),
  ).toBeVisible();
  await expect(page.getByText(transcriptSentinel, { exact: true })).toHaveCount(
    0,
  );

  const messageInput = page.getByLabel("Session message");
  await messageInput.fill("Draft context must not show old transcript");
  await expect(messageInput).toHaveValue(
    "Draft context must not show old transcript",
  );
  await expect(page.getByText(transcriptSentinel, { exact: true })).toHaveCount(
    0,
  );
  await expectNoFailureFeedback(page);
});

test("all-provider session list opens Claude and Copilot parity transcripts", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  await openListedSession(page, activeHarness, claudeParitySessionTitle);
  await expectParityTranscript(page, claudeParitySentinel);
  await expectNoParityTranscript(page, copilotParitySentinel);
  await expectNoFailureFeedback(page);

  await openListedSession(page, activeHarness, copilotParitySessionTitle);
  await expectParityTranscript(page, copilotParitySentinel);
  await expectNoParityTranscript(page, claudeParitySentinel);
  await expectNoFailureFeedback(page);
});

test("Codex configured draft prompt applies full config before first prompt", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();
  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("Codex").click();
  await expect(page.getByLabel("Approval Preset", { exact: true })).toHaveText(
    "Default",
  );
  await expect(page.getByLabel("Model", { exact: true })).toHaveText("GPT-5.5");
  await expect(page.getByLabel("Reasoning Effort", { exact: true })).toHaveText(
    "High",
  );
  await page.getByLabel("Select Model").click();
  await page.getByLabel("GPT-5.4-Mini").click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveText(
    "GPT-5.4-Mini",
  );
  await page.getByLabel("Select Reasoning Effort").click();
  await page.getByLabel("Medium").click();
  await expect(page.getByLabel("Reasoning Effort", { exact: true })).toHaveText(
    "Medium",
  );
  await page.getByLabel("Select Collaboration Mode").click();
  await page.getByLabel("Plan").click();
  await expect(
    page.getByLabel("Collaboration Mode", { exact: true }),
  ).toHaveText("Plan");
  await page.getByLabel("Session message").fill(newSessionPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(
    page.getByRole("heading", { name: capturedTerminalPlanHeading }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1. Yes, implement this plan" }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", {
      name: "2. No, and tell Codex what to do differently",
    })
    .click();
  await expect(
    page.getByLabel("Tell Codex what to do differently"),
  ).toBeVisible();
  await expectNoFailureFeedback(page);
});

test("Claude parity fixture drives configured draft prompt", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();

  await page.getByLabel("Select provider for new session").click();
  await page.getByRole("menuitem", { name: "Claude" }).click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveText("Default");
  await page.getByLabel("Select Model").click();
  await page.getByLabel("Haiku").click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveText("Haiku");
  await page.getByLabel("Session message").fill(claudeParityPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expectParityTranscript(page, claudeParitySentinel);
  await expectNoParityTranscript(page, copilotParitySentinel);
  await expectNoFailureFeedback(page);
});

test("Copilot parity fixture drives configured draft prompt", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await pairFrontend(page, activeHarness);

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();

  await page.getByLabel("Select provider for new session").click();
  await page.getByRole("menuitem", { name: "Copilot" }).click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveText(
    "GPT-5 mini",
  );
  await page.getByLabel("Select Model").click();
  await page.getByLabel("GPT-4.1").click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveText("GPT-4.1");
  await page.getByLabel("Session message").fill(copilotParityPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expectParityTranscript(page, copilotParitySentinel);
  await expectNoParityTranscript(page, claudeParitySentinel);
  await expectNoFailureFeedback(page);
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}
