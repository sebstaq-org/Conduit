import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
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
  await pairFrontend(page, activeHarness);

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
    "Full Access",
  );
  await expect(page.getByLabel("Model", { exact: true })).toHaveText("GPT-5.4");
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

test("pairing UI drives session commands through relay and reconnects", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);
  await expect(page.getByText("No desktop paired")).toBeVisible();
  await expect(page.getByLabel("Desktop idle indicator")).toBeVisible();
  await pairFrontend(page, activeHarness);

  await expect(page.getByText("Relay connected")).toBeVisible();
  await expect(page.getByLabel("Desktop connected indicator")).toBeVisible();
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
  await expectVisibleWithDiagnostics(
    page,
    activeHarness,
    page.getByLabel("Desktop connected indicator"),
  );
  await expect(page.getByText(fixtureCwd)).toBeVisible();

  await submitPairingUrl(page, tamperRelayEndpoint(pairingUrl));
  await expect(page.getByLabel("Desktop connecting indicator")).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.getByText(/relay websocket failed to connect/u).first(),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Desktop disconnected indicator")).toBeVisible();

  await pairFrontendWithUrl(page, await activeHarness.pairingUrl());
  await page.getByRole("button", { name: "Forget desktop" }).click();
  await expect(page.getByText("No desktop paired")).toBeVisible();
  await expect(page.getByLabel("Desktop idle indicator")).toBeVisible();
  await expect(page.getByText(fixtureCwd)).not.toBeVisible();
});

test("pair route refreshes the offer field for a new deep link", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  const firstOffer = offerFragmentValue(await activeHarness.pairingUrl());
  const secondOffer = offerFragmentValue(await activeHarness.pairingUrl());

  await page.goto(`${activeHarness.frontendUrl}/pair?offer=${firstOffer}`);
  await expect(page.getByLabel("Pairing link")).toHaveValue(
    `conduit://pair#offer=${firstOffer}`,
  );
  await page.goto(`${activeHarness.frontendUrl}/pair?offer=${secondOffer}`);
  await expect(page.getByLabel("Pairing link")).toHaveValue(
    `conduit://pair#offer=${secondOffer}`,
  );
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
  await page.goto(activeHarness.frontendUrl);
}

async function pairFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await pairFrontendWithUrl(page, await activeHarness.pairingUrl());
}

async function pairFrontendWithUrl(
  page: Page,
  pairingUrl: string,
): Promise<void> {
  await submitPairingUrl(page, pairingUrl);
  await expect(page.getByLabel("Desktop connected indicator")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Relay connected")).toBeVisible();
}

async function submitPairingUrl(page: Page, pairingUrl: string): Promise<void> {
  await page.getByLabel("Pairing link").fill(pairingUrl);
  await page.getByRole("button", { name: "Connect desktop" }).click();
}

function tamperRelayEndpoint(pairingUrl: string): string {
  const encodedOffer = offerFragmentValue(pairingUrl);
  const prefix = pairingUrl.slice(0, pairingUrl.indexOf(encodedOffer));
  const payload = JSON.parse(
    Buffer.from(encodedOffer, "base64url").toString("utf8"),
  ) as { relay: { endpoint: string } };
  payload.relay.endpoint = "http://127.0.0.1:9";
  return `${prefix}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

function offerFragmentValue(pairingUrl: string): string {
  const marker = "#offer=";
  const markerIndex = pairingUrl.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("pairing URL did not contain offer fragment");
  }
  return pairingUrl.slice(markerIndex + marker.length);
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
  const relaySnapshot = await activeHarness.relaySnapshot().catch(String);
  return JSON.stringify(
    {
      bodyText,
      browserSessionGroups,
      relaySnapshot,
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
