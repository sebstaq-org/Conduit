import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const fixtureSessionTitle = "Conduit E2E fixture session";
const newSessionPrompt =
  "Create a minimal deterministic plan for a Conduit E2E proof. Do not mention private paths, credentials, users, dates, machines, or external services. Return a short plan with the exact heading CONDUIT_E2E_CAPTURED_TERMINAL_PLAN.";
const capturedTerminalPlanHeading = "CONDUIT_E2E_CAPTURED_TERMINAL_PLAN";
const claudeParityPrompt =
  "Reply with exactly CONDUIT_E2E_CLAUDE_PARITY_RESPONSE. Do not include private paths, credentials, account names, user names, machine names, dates, or external service details.";
const claudeParitySentinel = "CONDUIT_E2E_CLAUDE_PARITY_RESPONSE";
const claudeParitySessionTitle = "Claude E2E parity session";
const copilotParityPrompt =
  "Reply with exactly CONDUIT_E2E_COPILOT_PARITY_RESPONSE. Do not include private paths, credentials, account names, user names, machine names, dates, or external service details.";
const copilotParitySentinel = "CONDUIT_E2E_COPILOT_PARITY_RESPONSE";
const copilotParitySessionTitle = "Copilot E2E parity session";
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
  await expectVisibleWithDiagnostics(page, activeHarness, sessionRow);
  await sessionRow.click();

  await expect(page.getByText(transcriptSentinel)).toBeVisible();
  await expectNoFailureFeedback(page);
});

test("all-provider session list opens Claude and Copilot parity transcripts", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  await openListedSession(page, activeHarness, claudeParitySessionTitle);
  await expectParityTranscript(page, claudeParitySentinel);
  await expectNoParityTranscript(page, copilotParitySentinel);
  await expectNoFailureFeedback(page);

  await openListedSession(page, activeHarness, copilotParitySessionTitle);
  await expectParityTranscript(page, copilotParitySentinel);
  await expectNoParityTranscript(page, claudeParitySentinel);
  await expectNoFailureFeedback(page);
});

test("new session applies selected collaboration mode before first prompt", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();
  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("codex").click();
  await page.getByLabel("Select Collaboration Mode").click();
  await page.getByLabel("Plan").click();
  await expect(page.getByText("Collaboration Mode: plan")).toBeVisible();
  await page.getByLabel("Session message").fill(newSessionPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.getByText(capturedTerminalPlanHeading)).toBeVisible();
  await expect(page.getByText("Implement this plan?")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1. Yes, implement this plan" }),
  ).toBeVisible();
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

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();

  await page.getByLabel("Select provider for new session").click();
  await page.getByRole("menuitem", { name: "claude" }).click();
  await expect(page.getByText("Model: default")).toBeVisible();
  await page.getByLabel("Select Model").click();
  await page.getByLabel("Haiku").click();
  await expect(page.getByText("Model: haiku")).toBeVisible();
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

  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expectVisibleWithDiagnostics(page, activeHarness, newSessionButton);
  await newSessionButton.click();

  await page.getByLabel("Select provider for new session").click();
  await page.getByRole("menuitem", { name: "copilot" }).click();
  await expect(page.getByText("Model: gpt-5-mini")).toBeVisible();
  await page.getByLabel("Select Model").click();
  await page.getByLabel("GPT-4.1").click();
  await expect(page.getByText("Model: gpt-4.1")).toBeVisible();
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

async function openListedSession(
  page: Page,
  activeHarness: E2eHarness,
  title: string,
): Promise<void> {
  const sessionRow = page.getByRole("button", { name: title });
  await expectVisibleWithDiagnostics(page, activeHarness, sessionRow);
  await sessionRow.click();
}

async function expectParityTranscript(
  page: Page,
  sentinel: string,
): Promise<void> {
  await expect(page.getByText(sentinel, { exact: true })).toBeVisible();
}

async function expectNoParityTranscript(
  page: Page,
  sentinel: string,
): Promise<void> {
  await expect(page.getByText(sentinel, { exact: true })).toHaveCount(0);
}

async function expectNoFailureFeedback(page: Page): Promise<void> {
  await expect(page.getByText("Request failed", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Session failed to open")).toHaveCount(0);
  await expect(page.getByText(/Couldn't open .* session/)).toHaveCount(0);
  await expect(page.getByText(/request failed\. Draft kept\./i)).toHaveCount(0);
  await expect(
    page.getByText("Your draft was kept. Edit it and try again."),
  ).toHaveCount(0);
}

async function pageDiagnostics(
  page: Page,
  activeHarness: E2eHarness,
): Promise<string> {
  const [bodyText, runtimeConfig, browserSessionGroups] = await Promise.all([
    page.locator("body").innerText({ timeout: 1_000 }).catch(String),
    page
      .evaluate(
        () =>
          (
            globalThis as {
              CONDUIT_RUNTIME_CONFIG?: { sessionWsUrl?: string };
            }
          ).CONDUIT_RUNTIME_CONFIG ?? null,
      )
      .catch(String),
    readBrowserSessionGroups(page, activeHarness.sessionWsUrl).catch(String),
  ]);
  return JSON.stringify(
    {
      bodyText,
      browserSessionGroups,
      runtimeConfig,
      sessionWsUrl: activeHarness.sessionWsUrl,
      url: page.url(),
    },
    null,
    2,
  );
}

async function readBrowserSessionGroups(
  page: Page,
  sessionWsUrl: string,
): Promise<unknown> {
  return await page.evaluate(
    (wsUrl) =>
      new Promise((resolve) => {
        const id = `browser-e2e-${Date.now()}`;
        const socket = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          socket.close();
          resolve({ error: "browser sessions/grouped timed out" });
        }, 5_000);
        socket.addEventListener("open", () => {
          socket.send(
            JSON.stringify({
              command: {
                command: "sessions/grouped",
                id,
                params: { updatedWithinDays: null },
                provider: "all",
              },
              id,
              type: "command",
              v: 1,
            }),
          );
        });
        socket.addEventListener("message", (event) => {
          const message = JSON.parse(String(event.data)) as {
            readonly id?: string;
            readonly response?: unknown;
            readonly type?: string;
          };
          if (message.type !== "response" || message.id !== id) {
            return;
          }
          clearTimeout(timeout);
          socket.close();
          resolve(message.response ?? null);
        });
        socket.addEventListener("error", () => {
          clearTimeout(timeout);
          resolve({ error: "browser sessions/grouped websocket error" });
        });
      }),
    sessionWsUrl,
  );
}
