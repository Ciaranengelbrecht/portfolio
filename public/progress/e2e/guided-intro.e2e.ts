import { expect, test, type Locator, type Page } from "@playwright/test";

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function requireBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box!;
}

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function expectPolishedStep(page: Page, targetId: string) {
  const card = page.locator("[data-guided-intro-card]");
  const highlight = page.locator("[data-guided-intro-highlight]");
  const target = page.locator(`[data-tour-id="${targetId}"]`);

  await expect(card).toBeVisible();
  await expect(highlight).toBeVisible();
  await expect(target).toBeVisible();
  await page.waitForTimeout(240);

  const cardBox = await requireBox(card);
  const highlightBox = await requireBox(highlight);
  const targetBox = await requireBox(target);
  const viewport = page.viewportSize();

  expect(overlaps(cardBox, targetBox)).toBe(false);
  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.y).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport!.width);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport!.height);
  expect(Math.abs(highlightBox.x - (targetBox.x - 8))).toBeLessThanOrEqual(4);
  expect(Math.abs(highlightBox.y - (targetBox.y - 8))).toBeLessThanOrEqual(4);
  expect(Math.abs(highlightBox.width - (targetBox.width + 16))).toBeLessThanOrEqual(6);
  expect(Math.abs(highlightBox.height - (targetBox.height + 16))).toBeLessThanOrEqual(6);
}

test("guided intro keeps highlights aligned and cards clear through route changes", async ({
  page,
}) => {
  await page.goto("/#/__guided-intro-test");

  await expect(page.getByRole("heading", { name: "Top target" })).toBeVisible();
  await expectPolishedStep(page, "harness-top-target");

  await page.getByRole("button", { name: /^Next$/ }).click();
  await expect(page.getByRole("heading", { name: "Low target" })).toBeVisible();
  await expectPolishedStep(page, "harness-low-target");

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/#\/__guided-intro-test\/next$/);
  await expect(page.getByRole("heading", { name: "Route target" })).toBeVisible();
  await expectPolishedStep(page, "harness-route-target");
});
