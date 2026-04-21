import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fixtureCwd, startE2eHarness } from "../src/harness.js";
import type { E2eHarness } from "../src/harness.js";

const navigationPanelDefaultWidth = 414;
const navigationPanelMaxWidth = 560;
const navigationPanelMinWidth = 280;

let harness: E2eHarness | null = null;

test.beforeAll(async () => {
  harness = await startE2eHarness();
});

test.afterAll(async () => {
  await harness?.stop();
});

test("desktop navigation panel can be resized within min and max bounds", async ({
  page,
}) => {
  const activeHarness = requireHarness();
  await activeHarness.addProject(fixtureCwd);
  await openFrontend(page, activeHarness);

  await expect(page.getByText("Projects", { exact: true })).toBeVisible();
  const resizeHandle = page.getByLabel("Resize navigation panel");
  await expect(resizeHandle).toBeVisible();

  const initialHandleBox = await measurableBoundingBox(resizeHandle);
  expect(Math.round(initialHandleBox.x)).toBe(navigationPanelDefaultWidth);

  await dragHandle(page, initialHandleBox.x, initialHandleBox.y, 320);
  const maxHandleBox = await measurableBoundingBox(resizeHandle);
  expect(Math.round(maxHandleBox.x)).toBe(navigationPanelMaxWidth);

  await dragHandle(page, maxHandleBox.x, maxHandleBox.y, -420);
  const minHandleBox = await measurableBoundingBox(resizeHandle);
  expect(Math.round(minHandleBox.x)).toBe(navigationPanelMinWidth);
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

async function measurableBoundingBox(
  locator: ReturnType<Page["getByLabel"]>,
): Promise<{ height: number; width: number; x: number; y: number }> {
  const box = await locator.boundingBox();

  if (box === null) {
    throw new Error("Resize handle was not measurable");
  }

  return box;
}

async function dragHandle(
  page: Page,
  x: number,
  y: number,
  deltaX: number,
): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 12 });
  await page.mouse.up();
}
