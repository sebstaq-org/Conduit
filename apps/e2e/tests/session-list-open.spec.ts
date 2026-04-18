import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
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
  await expectVisibleWithDiagnostics(page, activeHarness, sessionRow);
  await sessionRow.click();

  await expect(page.getByText(transcriptSentinel)).toBeVisible();
});

test("draft prompt in plan mode shows terminal plan decision", async ({
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

  await expect(page.getByLabel("Session message")).toHaveValue("");
  await expect(page.getByText(newSessionSentinel)).toBeVisible();
  await expect(page.getByText("Implement this plan?")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1. Yes, implement this plan" }),
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
