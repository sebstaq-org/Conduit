import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import { createSessionHistoryFixtureRoot } from "../src/session-history-fixture-root.js";
import type { E2eHarness } from "../src/harness.js";
import type { SessionHistoryFixtureRoot } from "../src/session-history-fixture-root.js";

interface HistoryCommandMetrics {
  clientHeight: number;
  remainingToTop: number;
  scrollHeight: number;
  scrollTop: number;
}

let fixtureRoot: SessionHistoryFixtureRoot | null = null;
let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  fixtureRoot = await createSessionHistoryFixtureRoot();
  harness = await startE2eHarness({ fixtureRoot: fixtureRoot.root });
  await harness.addProject(fixtureCwd);
});

test.afterAll(async () => {
  await harness?.stop();
  await fixtureRoot?.cleanup();
});

test("session history opens at the latest message", async ({ page }) => {
  const fixture = requireFixtureRoot();
  const activeHarness = requireHarness();
  await openFrontend(page, activeHarness);
  await openListedSession(page, fixture.historySessionTitle);

  await expect(page.getByText(fixture.latestSentinel, { exact: true })).toBeVisible();
  await expect(page.getByText(fixture.earliestSentinel, { exact: true })).toHaveCount(0);
  await expectNoFailureFeedback(page);
});

test("session history follows delayed streaming output while at bottom", async ({
  page,
}) => {
  const fixture = requireFixtureRoot();
  const activeHarness = requireHarness();
  await openFrontend(page, activeHarness);
  await openListedSession(page, fixture.followSessionTitle);

  await sendSessionPrompt(page, fixture.followPrompt);

  await expect(page.getByText(fixture.followSentinel, { exact: true })).toBeVisible();
  await expectNoFailureFeedback(page);
});

test("session history stops following delayed streaming output after user scrolls up", async ({
  page,
}) => {
  const fixture = requireFixtureRoot();
  const activeHarness = requireHarness();
  await openFrontend(page, activeHarness);
  await openListedSession(page, fixture.stopFollowSessionTitle);

  await sendSessionPrompt(page, fixture.stopFollowPrompt);
  await page.waitForTimeout(250);
  await scrollHistoryBy(page, 900);
  await page.waitForTimeout(1_800);

  expect(
    await isTextVisibleInHistoryViewport(page, fixture.stopFollowSentinel),
  ).toBe(false);

  await scrollHistoryToLatest(page);
  await expect(
    page.getByText(fixture.stopFollowSentinel, { exact: true }),
  ).toBeVisible();
  await expectNoFailureFeedback(page);
});

test("session history prefetches older messages before the user reaches the top", async ({
  page,
}) => {
  const fixture = requireFixtureRoot();
  const activeHarness = requireHarness();
  await openFrontend(page, activeHarness);
  await openListedSession(page, fixture.historySessionTitle);

  await expect(page.getByText(fixture.earliestSentinel, { exact: true })).toHaveCount(0);
  await scrollUntil(page, async () => (await readHistoryCommandMetrics(page)).length > 0, {
    delta: 220,
    maxIterations: 20,
  });
  await scrollUntil(
    page,
    async () => (await page.getByText(fixture.earliestSentinel, { exact: true }).count()) > 0,
    { delta: 220, maxIterations: 20 },
  );

  await expect(page.getByText(fixture.earliestSentinel, { exact: true })).toBeVisible();
  const [firstHistoryCommand] = await readHistoryCommandMetrics(page);
  if (firstHistoryCommand === undefined) {
    throw new Error("expected at least one session/history command");
  }
  expect(firstHistoryCommand.remainingToTop).toBeGreaterThan(0);
  await expectNoFailureFeedback(page);
});

test("session history keeps the viewport anchor stable when older messages load", async ({
  page,
}) => {
  const fixture = requireFixtureRoot();
  const activeHarness = requireHarness();
  await openFrontend(page, activeHarness);
  await openListedSession(page, fixture.historySessionTitle);

  await scrollUntil(
    page,
    async () => (await page.getByText(fixture.anchorSentinel, { exact: true }).count()) > 0,
    { delta: 180, maxIterations: 20 },
  );

  const topBefore = await textTop(page, fixture.anchorSentinel);
  expect(topBefore).not.toBeNull();

  await scrollUntil(page, async () => (await readHistoryCommandMetrics(page)).length > 0, {
    delta: 120,
    maxIterations: 12,
  });
  await page.waitForTimeout(300);

  const topAfter = await textTop(page, fixture.anchorSentinel);
  expect(topAfter).not.toBeNull();
  expect(Math.abs((topAfter ?? 0) - (topBefore ?? 0))).toBeLessThanOrEqual(40);
  await expectNoFailureFeedback(page);
});

function requireHarness(): E2eHarness {
  if (harness === null) {
    throw new Error("E2E harness did not start");
  }
  return harness;
}

function requireFixtureRoot(): SessionHistoryFixtureRoot {
  if (fixtureRoot === null) {
    throw new Error("session history fixture root was not created");
  }
  return fixtureRoot;
}

async function openFrontend(
  page: Page,
  activeHarness: E2eHarness,
): Promise<void> {
  await page.addInitScript((sessionWsUrl) => {
    const findHistoryScrollElement = (): HTMLElement | null => {
      const labeledCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="session-history-list"], [aria-label="Session history"]',
        ),
      ).filter((element) => element.scrollHeight > element.clientHeight + 20);
      if (labeledCandidates.length > 0) {
        return labeledCandidates[0] ?? null;
      }
      const fallbackCandidates = Array.from(
        document.querySelectorAll<HTMLElement>("div"),
      )
        .filter((element) => element.scrollHeight > element.clientHeight + 20)
        .sort((left, right) => right.scrollHeight - left.scrollHeight);
      return fallbackCandidates[0] ?? null;
    };
    const sentHistoryCommands: Array<{
      metrics: {
        clientHeight: number;
        remainingToTop: number;
        scrollHeight: number;
        scrollTop: number;
      } | null;
    }> = [];
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function patchedSend(data) {
      try {
        const parsed =
          typeof data === "string" ? JSON.parse(data) : { command: null };
        if (parsed?.command?.command === "session/history") {
          const element = findHistoryScrollElement();
          sentHistoryCommands.push({
            metrics:
              element === null
                ? null
                : {
                    clientHeight: element.clientHeight,
                    remainingToTop: Math.max(
                      0,
                      element.scrollHeight -
                        element.clientHeight -
                        element.scrollTop,
                    ),
                    scrollHeight: element.scrollHeight,
                    scrollTop: element.scrollTop,
                  },
          });
        }
      } catch {
        /* ignore websocket tracking parse failures */
      }
      return originalSend.call(this, data);
    };
    (
      globalThis as {
        CONDUIT_RUNTIME_CONFIG?: { sessionWsUrl: string };
        __conduitFindSessionHistoryElement?: () => HTMLElement | null;
        __conduitSessionHistoryCommands?: Array<{
          metrics: {
            clientHeight: number;
            remainingToTop: number;
            scrollHeight: number;
            scrollTop: number;
          } | null;
        }>;
      }
    ).CONDUIT_RUNTIME_CONFIG = { sessionWsUrl };
    (
      globalThis as {
        __conduitFindSessionHistoryElement?: () => HTMLElement | null;
      }
    ).__conduitFindSessionHistoryElement = findHistoryScrollElement;
    (
      globalThis as {
        __conduitSessionHistoryCommands?: Array<{
          metrics: {
            clientHeight: number;
            remainingToTop: number;
            scrollHeight: number;
            scrollTop: number;
          } | null;
        }>;
      }
    ).__conduitSessionHistoryCommands = sentHistoryCommands;
  }, activeHarness.sessionWsUrl);
  await page.goto(activeHarness.frontendUrl);
}

async function openListedSession(page: Page, title: string): Promise<void> {
  const sessionRow = page.getByRole("button", { name: title });
  await expect(sessionRow).toBeVisible();
  await sessionRow.click();
}

async function sendSessionPrompt(page: Page, prompt: string): Promise<void> {
  await page.getByLabel("Session message").fill(prompt);
  const sendButton = page.getByRole("button", { name: "Send message" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
}

async function scrollHistoryBy(page: Page, delta: number): Promise<void> {
  await page.evaluate((amount) => {
    const target = (
      globalThis as {
        __conduitFindSessionHistoryElement?: () => HTMLElement | null;
      }
    ).__conduitFindSessionHistoryElement?.();
    if (target === null || target === undefined) {
      throw new Error("session history element not found");
    }
    target.scrollTop += amount;
    target.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, delta);
  await page.waitForTimeout(100);
}

async function scrollHistoryToLatest(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = (
      globalThis as {
        __conduitFindSessionHistoryElement?: () => HTMLElement | null;
      }
    ).__conduitFindSessionHistoryElement?.();
    if (target === null || target === undefined) {
      throw new Error("session history element not found");
    }
    target.scrollTop = 0;
    target.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(100);
}

async function readHistoryCommandMetrics(
  page: Page,
): Promise<HistoryCommandMetrics[]> {
  return await page.evaluate(() => {
    const commands =
      (
        globalThis as {
          __conduitSessionHistoryCommands?: Array<{
            metrics:
              | {
                  clientHeight: number;
                  remainingToTop: number;
                  scrollHeight: number;
                  scrollTop: number;
                }
              | null;
          }>;
        }
      ).__conduitSessionHistoryCommands ?? [];
    return commands
      .map((entry) => entry.metrics)
      .filter(
        (entry): entry is HistoryCommandMetrics =>
          entry !== null &&
          typeof entry.clientHeight === "number" &&
          typeof entry.remainingToTop === "number" &&
          typeof entry.scrollHeight === "number" &&
          typeof entry.scrollTop === "number",
      );
  });
}

async function scrollUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  options: { delta: number; maxIterations: number },
): Promise<void> {
  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    if (await predicate()) {
      return;
    }
    await scrollHistoryBy(page, options.delta);
  }
  expect(await predicate()).toBe(true);
}

async function textTop(page: Page, text: string): Promise<number | null> {
  const locator = page.getByText(text, { exact: true }).first();
  if ((await locator.count()) === 0) {
    return null;
  }
  const box = await locator.boundingBox();
  return box?.y ?? null;
}

async function isTextVisibleInHistoryViewport(
  page: Page,
  text: string,
): Promise<boolean> {
  const historyLocator = page.getByLabel("Session history");
  if ((await historyLocator.count()) === 0) {
    return false;
  }
  const historyBox = await historyLocator.boundingBox();
  if (historyBox === null) {
    return false;
  }
  const textLocator = page.getByText(text, { exact: true }).first();
  if ((await textLocator.count()) === 0) {
    return false;
  }
  const textBox = await textLocator.boundingBox();
  if (textBox === null) {
    return false;
  }
  return (
    textBox.y + textBox.height > historyBox.y &&
    textBox.y < historyBox.y + historyBox.height
  );
}

async function expectNoFailureFeedback(page: Page): Promise<void> {
  await expect(page.getByText("Request failed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Session failed to open")).toHaveCount(0);
  await expect(page.getByText(/Couldn't open .* session/)).toHaveCount(0);
  await expect(page.getByText(/request failed\. Draft kept\./i)).toHaveCount(0);
  await expect(
    page.getByText("Your draft was kept. Edit it and try again."),
  ).toHaveCount(0);
}
