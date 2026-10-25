import { expect, test } from '@playwright/test';

// SPEC-0004 CA-11: /mire.sqlite3 opens, migrates once and persists next to the storage-test database.
test('the real database is migrated once and persists across reloads', async ({ page }) => {
  await page.goto('./');

  const version = page.getByTestId('db-version');
  await expect(version).toHaveText('1');
  const appliedAt = await version.getAttribute('data-applied-at');
  expect(appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  await expect(page.getByText('Base de datos: versión')).toBeVisible();

  // The SPEC-0002 storage test still works with both databases in opfs-sahpool.
  const count = page.getByTestId('smoke-count');
  await expect(count).toHaveText('0');
  await page.getByRole('button', { name: 'Probar almacenamiento' }).click();
  await expect(count).toHaveText('1');

  await page.reload();
  await expect(count).toHaveText('1');
  await expect(version).toHaveText('1');
  await expect(version).toHaveAttribute('data-applied-at', appliedAt!);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
