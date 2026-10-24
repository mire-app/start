import { expect, test } from '@playwright/test';

// CA-06: SQLite (opfs-sahpool) persists without COOP/COEP headers.
test('storage test persists across reloads', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);

  const count = page.getByTestId('smoke-count');
  await expect(count).toHaveText('0');
  await page.getByRole('button', { name: 'Probar almacenamiento' }).click();
  await expect(count).toHaveText('1');

  await page.reload();
  await expect(count).toHaveText('1');
});
