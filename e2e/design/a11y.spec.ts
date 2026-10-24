import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// CA-04 (SPEC-0003): no axe violations (WCAG 2.0 A/AA, 2.1 AA, 2.2 AA) in either theme.
const PAGES = [
  ['home screen', './'],
  ['style guide', './estilo.html'],
] as const;

async function ready(page: Page, url: string) {
  if (url === './') await expect(page.getByTestId('smoke-count')).toHaveText('0');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const [name, url] of PAGES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${name} has no accessibility violations in the ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await ready(page, url);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const violations = results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(' ')),
      }));
      expect(violations).toEqual([]);
    });
  }
}
