import { expect, test, type Page } from '@playwright/test';

// CA-09 and CA-11 (SPEC-0003) in a 375 px wide mobile viewport.
test.use({ viewport: { width: 375, height: 812 } });

const PAGES = [
  ['home screen', './'],
  ['style guide', './estilo.html'],
] as const;

async function open(page: Page, url: string) {
  await page.goto(url);
  if (url === './') await expect(page.getByTestId('smoke-count')).toHaveText('0');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const [name, url] of PAGES) {
  test(`${name} has no horizontal scroll at 375 px`, async ({ page }) => {
    await open(page, url);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(clientWidth).toBe(375);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test(`${name}: icon-only buttons are labelled and controls measure at least 44 × 44 px`, async ({
    page,
  }) => {
    await open(page, url);

    const unlabelled = await page.locator('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => button.querySelector('svg'))
        .filter((button) => (button.textContent ?? '').trim() === '')
        .filter((button) => !(button.getAttribute('aria-label') ?? '').trim())
        .map((button) => button.outerHTML),
    );
    expect(unlabelled).toEqual([]);

    const controls = page.locator(
      'header button, header a, header select, header input, main select',
    );
    expect(await controls.count()).toBeGreaterThanOrEqual(2);
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box, await control.evaluate((el) => el.outerHTML)).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
