import { expect, test } from "@playwright/test";
import { parseConnectionOfferUrl } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import { fixtureCwd } from "../src/harness.js";
import { startDesktopE2eHarness } from "../src/desktopHarness.js";
import type { Page } from "@playwright/test";
import type { DesktopE2eHarness } from "../src/desktopHarness.js";

const desktopStreamdownPrompt =
  "Stream a markdown proof for desktop Streamdown rendering.";
const desktopStreamdownHeading = "CONDUIT_DESKTOP_STREAMDOWN_E2E";
const desktopStreamdownBody = "desktop Streamdown renders chunked markdown.";

let harness: DesktopE2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startDesktopE2eHarness();
});

test.afterAll(async () => {
  await harness?.stop();
});

test("desktop starts daemon, exposes QR pairing, relays commands, and survives restart", async () => {
  const activeHarness = requireHarness();
  const page = activeHarness.page;
  // Per user contract: desktop must not say connected/connecting before it knows about a real mobile peer.
  // Do not change without an explicit product decision.
  await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Connecting", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mobile pairing controls" }),
  ).toBeVisible();

  const beforeStatus = await readDesktopStatus(page);
  expect(beforeStatus.running).toBe(true);
  expect(beforeStatus.backendHealthy).toBe(true);
  expect(beforeStatus.relayConfigured).toBe(true);
  expect(beforeStatus.mobilePeerConnected).toBe(false);
  expect(beforeStatus.daemon?.presence.clients).toEqual([]);

  await openDesktopPairingPopover(page);
  await page
    .getByRole("button", { name: "Create mobile pairing link" })
    .click();
  await expect(page.getByLabel("Mobile pairing QR")).toBeVisible();
  const mobileUrl = await page
    .getByRole("textbox", { name: "Mobile pairing link" })
    .inputValue();
  expect(mobileUrl).toMatch(/^conduit:\/\/pair\?offer=/u);

  const offer = parseConnectionOfferUrl(mobileUrlAsFragment(mobileUrl));
  const client = createRelaySessionClient({ offer });
  await client.updatePresence(mobilePresence());
  await expectEventuallySettings(client);
  await expect(
    page.getByLabel("Mobile pairing connected indicator"),
  ).toBeVisible({ timeout: 15000 });

  const projects = await client.addProject({ cwd: fixtureCwd });
  expect(projects.projects.some((project) => project.cwd === fixtureCwd)).toBe(
    true,
  );
  await expect(client.listProjects()).resolves.toMatchObject({
    projects: expect.arrayContaining([
      expect.objectContaining({ cwd: fixtureCwd }),
    ]),
  });
  await expect(
    client.getSessionGroups({ updatedWithinDays: null }),
  ).resolves.toMatchObject({
    groups: expect.arrayContaining([
      expect.objectContaining({ cwd: fixtureCwd }),
    ]),
  });

  const relaySnapshot = await activeHarness.relaySnapshot(offer.relay.serverId);
  expect(relaySnapshot.controlSocketCount).toBeGreaterThanOrEqual(1);
  expect(relaySnapshot.clientSocketCount).toBeGreaterThanOrEqual(1);
  expect(relaySnapshot.dataSocketCount).toBeGreaterThanOrEqual(1);
  expect(relaySnapshot.clientMessageCount).toBeGreaterThanOrEqual(1);
  expect(relaySnapshot.dataMessageCount).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(relaySnapshot)).not.toContain("settings/get");
  expect(JSON.stringify(relaySnapshot)).not.toContain("sessions/grouped");

  client.close();
  await closePopover(page);
  await restartDesktopDaemon(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Mobile pairing controls" }),
  ).toBeVisible({ timeout: 60000 });
  const afterStatus = await readDesktopStatus(page);
  expect(afterStatus.restartCount).toBeGreaterThanOrEqual(1);

  await openDesktopPairingPopover(page);
  await page
    .getByRole("button", { name: "Create mobile pairing link" })
    .click();
  const restartedMobileUrl = await page
    .getByRole("textbox", { name: "Mobile pairing link" })
    .inputValue();
  const restartedOffer = parseConnectionOfferUrl(
    mobileUrlAsFragment(restartedMobileUrl),
  );
  const reconnectedClient = createRelaySessionClient({ offer: restartedOffer });
  await reconnectedClient.updatePresence(mobilePresence());
  await expectEventuallySettings(reconnectedClient);
  await expect(
    page.getByLabel("Mobile pairing connected indicator"),
  ).toBeVisible({ timeout: 15000 });
  reconnectedClient.close();
  await closePopover(page);
});

test("desktop renders streaming markdown through Streamdown", async () => {
  const activeHarness = requireHarness();
  const page = activeHarness.page;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Mobile pairing controls" }),
  ).toBeVisible({ timeout: 60000 });
  await activeHarness.addProject(fixtureCwd);
  const newSessionButton = page.getByLabel(`New session in ${fixtureCwd}`);
  await expect(newSessionButton).toBeVisible({ timeout: 60000 });
  await newSessionButton.click();
  await page.getByLabel("Select provider for new session").click();
  await page.getByLabel("Codex").click();
  await page.getByLabel("Session message").fill(desktopStreamdownPrompt);

  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.getByText(desktopStreamdownHeading)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(desktopStreamdownBody)).toBeVisible();
  await expect(page.getByText("First streamed item")).toBeVisible();
  await expect(page.getByText("Second streamed item")).toBeVisible();
  if (process.env.CONDUIT_E2E_DESKTOP_STREAMDOWN_SCREENSHOT !== undefined) {
    await page.screenshot({
      fullPage: true,
      path: process.env.CONDUIT_E2E_DESKTOP_STREAMDOWN_SCREENSHOT,
    });
  }
  expectNoStreamdownRendererErrors([...pageErrors, ...consoleErrors]);
});

function requireHarness(): DesktopE2eHarness {
  if (harness === null) {
    throw new Error("desktop E2E harness did not start");
  }
  return harness;
}

function mobileUrlAsFragment(mobileUrl: string): string {
  const offer = new URL(mobileUrl).searchParams.get("offer");
  if (offer === null || offer.length === 0) {
    throw new Error("mobile pairing URL is missing offer query parameter");
  }
  return `conduit://pair#offer=${offer}`;
}

async function openDesktopPairingPopover(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Mobile pairing controls" }).click();
  await expect(
    page.getByRole("button", { name: "Create mobile pairing link" }),
  ).toBeVisible();
}

async function closePopover(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
}

async function restartDesktopDaemon(page: Page): Promise<void> {
  await page.evaluate(
    async () =>
      await (
        globalThis as unknown as {
          conduitDesktop: {
            restartDaemon(): Promise<unknown>;
          };
        }
      ).conduitDesktop.restartDaemon(),
  );
}

async function readDesktopStatus(page: Page): Promise<{
  readonly backendHealthy: boolean;
  readonly daemon: {
    readonly presence: {
      readonly clients: readonly unknown[];
    };
  } | null;
  readonly mobilePeerConnected: boolean;
  readonly relayConfigured: boolean;
  readonly restartCount: number;
  readonly running: boolean;
}> {
  return await page.evaluate(
    async () =>
      await (
        globalThis as unknown as {
          conduitDesktop: {
            getDaemonStatus(): Promise<{
              readonly backendHealthy: boolean;
              readonly daemon: {
                readonly presence: {
                  readonly clients: readonly unknown[];
                };
              } | null;
              readonly mobilePeerConnected: boolean;
              readonly relayConfigured: boolean;
              readonly restartCount: number;
              readonly running: boolean;
            }>;
          };
        }
      ).conduitDesktop.getDaemonStatus(),
  );
}

function mobilePresence(): {
  readonly clientId: string;
  readonly deviceKind: "mobile";
  readonly displayName: string;
} {
  return {
    clientId: "desktop-e2e-mobile-client",
    deviceKind: "mobile",
    displayName: "E2E Mobile",
  };
}

async function expectEventuallySettings(client: {
  getSettings(): Promise<unknown>;
}): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  while (Date.now() - startedAt < 15000) {
    try {
      await expect(client.getSettings()).resolves.toMatchObject({});
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function expectNoStreamdownRendererErrors(messages: readonly string[]): void {
  const rendererErrors = messages.filter((message) =>
    /streamdown|remend|worklet|object is not a function/iu.test(message),
  );
  expect(rendererErrors).toEqual([]);
}
