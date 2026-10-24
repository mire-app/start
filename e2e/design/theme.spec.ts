import { expect, test } from '@playwright/test';

// CA-05 (SPEC-0003): theme follows the system, «Oscuro» persists, and it is set before paint.
const PAGES = [
  ['home screen', './'],
  ['style guide', './estilo.html'],
] as const;

for (const [name, url] of PAGES) {
  test(`${name}: without a saved choice the theme follows prefers-color-scheme`, async ({
    page,
  }) => {
    const html = page.locator('html');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      await expect(html).toHaveAttribute('data-theme', scheme);
      await expect(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('system');
    }
  });

  test(`${name}: choosing «Oscuro» applies the dark theme and keeps it after reloading`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(url);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('combobox', { name: 'Tema' }).selectOption({ label: 'Oscuro' });
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('dark');
  });

  test(`${name}: data-theme is already set at DOMContentLoaded`, async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        (window as unknown as { themeAtDomContentLoaded: string | null }).themeAtDomContentLoaded =
          theme;
      });
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url);
    const theme = await page.evaluate(
      () =>
        (window as unknown as { themeAtDomContentLoaded?: string | null }).themeAtDomContentLoaded,
    );
    expect(theme).toBe('dark');
  });
}
