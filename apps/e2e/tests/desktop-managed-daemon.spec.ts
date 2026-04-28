import { expect, test } from "@playwright/test";
import { parseConnectionOfferUrl } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import { fixtureCwd } from "../src/harness.js";
import { startDesktopE2eHarness } from "../src/desktopHarness.js";
import type { Page } from "@playwright/test";
import type { DesktopE2eHarness } from "../src/desktopHarness.js";

test.describe.configure({ mode: "serial" });
// This spec proves the built desktop shell against a real Rust daemon and relay.
// Per user contract: desktop E2E uses Chromium/Electron sandbox by default.

const desktopStreamdownPrompt =
  "Stream a markdown proof for desktop Streamdown rendering.";
const desktopStreamdownHeading = "CONDUIT_DESKTOP_STREAMDOWN_E2E";
const desktopStreamdownBody = "desktop Streamdown renders chunked markdown.";
const recoveryLastExitPattern = /spawn failed|exited code=-2 signal=null/iu;

let harness: DesktopE2eHarness | null = null;

function desktopPairingTrigger(page: Page) {
  return page.locator('[aria-label="Mobile pairing controls"]');
}

test.afterAll(async () => {
  await harness?.stop();
});

test("desktop opens recovery UI when daemon startup fails", async () => {
  const failingHarness = await startDesktopE2eHarness({
    serviceBinPath: "/tmp/conduit-missing-service-bin",
  });
  try {
    const page = failingHarness.page;
    await expect(desktopPairingTrigger(page)).toBeVisible({
      timeout: 60000,
    });
    await openDesktopPairingPopover(page);
    await expect(page.getByText("Desktop needs attention")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Restart daemon" }),
    ).toBeVisible();
    await expect(readDesktopStatus(page)).resolves.toMatchObject({
      backendHealthy: false,
      lastExit: expect.stringMatching(recoveryLastExitPattern),
      running: false,
    });
  } finally {
    await failingHarness.stop();
  }
});

test("desktop starts daemon, exposes QR pairing, relays commands, and survives restart", async () => {
  const activeHarness = await requireHarness();
  const page = activeHarness.page;
  // Per user contract: desktop must not say connected/connecting before it knows about a real mobile peer.
  // Do not change without an explicit product decision.
  await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Connecting", { exact: true })).toHaveCount(0);
  await expect(desktopPairingTrigger(page)).toBeVisible();

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
  expect(mobileUrl).toMatch(/^conduit-dev:\/\/pair\?offer=/u);

  const offer = parseConnectionOfferUrl(mobileUrl);
  const client = createRelaySessionClient({ offer });
  await client.updatePresence(mobilePresence());
  await expectEventuallySettings(client);
  await expect(
    page.getByLabel("Mobile pairing connected indicator"),
  ).toBeVisible({ timeout: 15000 });
  await closePopover(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(desktopPairingTrigger(page)).toBeVisible({
    timeout: 60000,
  });
  await openDesktopPairingPopover(page);
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
  await expect(desktopPairingTrigger(page)).toBeVisible({
    timeout: 60000,
  });
  const afterStatus = await readDesktopStatus(page);
  expect(afterStatus.restartCount).toBeGreaterThanOrEqual(1);

  await openDesktopPairingPopover(page);
  await page
    .getByRole("button", { name: "Create mobile pairing link" })
    .click();
  const restartedMobileUrl = await page
    .getByRole("textbox", { name: "Mobile pairing link" })
    .inputValue();
  const restartedOffer = parseConnectionOfferUrl(restartedMobileUrl);
  const reconnectedClient = createRelaySessionClient({ offer: restartedOffer });
  await reconnectedClient.updatePresence(mobilePresence());
  await expectEventuallySettings(reconnectedClient);
  await expect(
    page.getByLabel("Mobile pairing connected indicator"),
  ).toBeVisible({ timeout: 15000 });
  reconnectedClient.close();
  await closePopover(page);
});

test("desktop reports recovery when the managed daemon exits", async () => {
  const activeHarness = await requireHarness();
  const page = activeHarness.page;
  const beforeStatus = await readDesktopStatus(page);
  if (beforeStatus.pid === null) {
    throw new Error("desktop daemon pid was not available before kill");
  }

  process.kill(beforeStatus.pid, "SIGTERM");
  await expect
    .poll(async () => await readDesktopStatus(page), { timeout: 15000 })
    .toMatchObject({
      backendHealthy: false,
      lastExit: expect.stringMatching(/exited code=.*signal=/iu),
      running: false,
    });

  await restartDesktopDaemon(page);
  await expect
    .poll(async () => await readDesktopStatus(page), { timeout: 30000 })
    .toMatchObject({
      backendHealthy: true,
      running: true,
    });
});

test("desktop renders streaming markdown through Streamdown", async () => {
  const activeHarness = await requireHarness();
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
  await expect(desktopPairingTrigger(page)).toBeVisible({
    timeout: 60000,
  });
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

test("desktop quit stops the managed daemon process", async () => {
  const activeHarness = await requireHarness();
  const status = await readDesktopStatus(activeHarness.page);
  if (status.pid === null) {
    throw new Error("desktop daemon pid was not available before quit");
  }

  await activeHarness.quitDesktop();
  await expectProcessGone(status.pid);
});

async function requireHarness(): Promise<DesktopE2eHarness> {
  if (harness === null) {
    harness = await startDesktopE2eHarness();
  }
  return harness;
}

async function openDesktopPairingPopover(page: Page): Promise<void> {
  await desktopPairingTrigger(page).click();
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
  readonly lastExit: string | null;
  readonly mobilePeerConnected: boolean;
  readonly pid: number | null;
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
              readonly lastExit: string | null;
              readonly mobilePeerConnected: boolean;
              readonly pid: number | null;
              readonly relayConfigured: boolean;
              readonly restartCount: number;
              readonly running: boolean;
            }>;
          };
        }
      ).conduitDesktop.getDaemonStatus(),
  );
}

async function expectProcessGone(pid: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    if (!processIsRunning(pid)) {
      return;
    }
    await delay(250);
  }
  throw new Error(`daemon process ${String(pid)} survived desktop quit`);
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
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
