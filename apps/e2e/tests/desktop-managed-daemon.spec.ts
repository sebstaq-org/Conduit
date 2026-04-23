import { expect, test } from "@playwright/test";
import { parseConnectionOfferUrl } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import { fixtureCwd } from "../src/harness.js";
import { startDesktopE2eHarness } from "../src/desktopHarness.js";
import type { Page } from "@playwright/test";
import type { DesktopE2eHarness } from "../src/desktopHarness.js";

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
  await expect(page.getByText("Mobile pairing", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByLabel("Connecting indicator")).toBeVisible();
  await expect(page.getByText("Status not loaded")).toBeVisible();

  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Daemon ready")).toBeVisible({ timeout: 60000 });
  await expect(page.getByLabel("Connected indicator")).toBeVisible();
  const beforeStatus = await readDesktopStatus(page);
  expect(beforeStatus.running).toBe(true);
  expect(beforeStatus.backendHealthy).toBe(true);
  expect(beforeStatus.relayConfigured).toBe(true);

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
  await expectEventuallySettings(client);

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

  await page.getByRole("button", { name: "Restart daemon" }).click();
  await expect(page.getByText("Daemon ready")).toBeVisible({ timeout: 60000 });
  await expect(page.getByLabel("Connected indicator")).toBeVisible();
  const afterStatus = await readDesktopStatus(page);
  expect(afterStatus.restartCount).toBeGreaterThanOrEqual(1);

  client.close();
  const reconnectedClient = createRelaySessionClient({ offer });
  await expectEventuallySettings(reconnectedClient);
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

async function readDesktopStatus(page: Page): Promise<{
  readonly backendHealthy: boolean;
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
              readonly relayConfigured: boolean;
              readonly restartCount: number;
              readonly running: boolean;
            }>;
          };
        }
      ).conduitDesktop.getDaemonStatus(),
  );
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
