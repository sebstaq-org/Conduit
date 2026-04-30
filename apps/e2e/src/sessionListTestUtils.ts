import { expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import type { Locator, Page } from "@playwright/test";
import { fixtureCwd } from "./harness.js";
import type { E2eHarness } from "./harness.js";

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
const mobileViewport = { height: 844, width: 390 };

async function openFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await page.goto(activeHarness.frontendUrl);
}

async function openMobileFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await page.setViewportSize(mobileViewport);
  await openFrontend(page, activeHarness);
}

async function openMobileNavigationPanel(page: Page): Promise<void> {
  await page.getByLabel("Open navigation panel").click();
  await expect(
    page.getByLabel(`New session in ${fixtureCwd}`),
  ).toBeInViewport();
}

async function expectMobileNavigationPanelClosed(page: Page): Promise<void> {
  await expect(
    page.getByLabel(`New session in ${fixtureCwd}`),
  ).not.toBeInViewport();
}

async function pairFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await pairFrontendWithUrl(page, await activeHarness.pairingUrl());
}

async function pairFrontendFromPairRoute(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  const pairingUrl = await activeHarness.pairingUrl();
  await page.goto(
    `${activeHarness.frontendUrl}/pair?offer=${offerFragmentValue(pairingUrl)}`,
  );
  await submitPairingUrl(page, pairingUrl);
  await expect(page.getByLabel("Desktop connected indicator")).toBeVisible({
    timeout: 15000,
  });
  await page.goto(activeHarness.frontendUrl);
}

async function pairFrontendWithUrl(
  page: Page,
  pairingUrl: string,
): Promise<void> {
  await openHostPairingPopover(page);
  await submitPairingUrl(page, pairingUrl);
  await expect(page.getByLabel("Desktop connected indicator")).toBeVisible({
    timeout: 15000,
  });
  await closePopover(page);
}

async function submitPairingUrl(page: Page, pairingUrl: string): Promise<void> {
  await page.getByLabel("Pairing link").fill(pairingUrl);
  await page.getByRole("button", { name: "Connect desktop" }).click();
}

async function openHostPairingPopover(page: Page): Promise<void> {
  if (
    await page
      .getByLabel("Pairing link")
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  await page
    .locator('button[aria-label="Desktop connection controls"]:visible')
    .last()
    .click();
  await expect(page.getByLabel("Pairing link")).toBeVisible();
}

async function closePopover(page: Page): Promise<void> {
  if (
    !(await page
      .getByLabel("Pairing link")
      .isVisible()
      .catch(() => false))
  ) {
    return;
  }
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Pairing link")).toHaveCount(0);
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
  await expect(page.getByText("Session failed to open")).toHaveCount(0);
  await expect(page.getByText(/Couldn't open .* session/)).toHaveCount(0);
  await expect(page.getByText(/request failed\./i)).toHaveCount(0);
  await expect(
    page.getByText("Your message was sent to the session."),
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

export {
  capturedTerminalPlanHeading,
  claudeParityPrompt,
  claudeParitySentinel,
  claudeParitySessionTitle,
  closePopover,
  copilotParityPrompt,
  copilotParitySentinel,
  copilotParitySessionTitle,
  expectMobileNavigationPanelClosed,
  expectNoFailureFeedback,
  expectNoParityTranscript,
  expectParityTranscript,
  expectVisibleWithDiagnostics,
  fixtureSessionTitle,
  newSessionPrompt,
  offerFragmentValue,
  openFrontend,
  openHostPairingPopover,
  openListedSession,
  openMobileFrontend,
  openMobileNavigationPanel,
  pairFrontend,
  pairFrontendFromPairRoute,
  pairFrontendWithUrl,
  submitPairingUrl,
  tamperRelayEndpoint,
  transcriptSentinel,
};
