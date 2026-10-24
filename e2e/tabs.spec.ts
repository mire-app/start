import { expect, test } from '@playwright/test';

// CA-08: a second tab shows the notice and the first one keeps working.
test('a second tab shows the already-open notice', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('./');
  await expect(first.getByTestId('smoke-count')).toHaveText('0');

  const second = await context.newPage();
  await second.goto('./');
  await expect(second.getByRole('alert')).toHaveText('Míre ya está abierto en otra pestaña');

  await first.getByRole('button', { name: 'Probar almacenamiento' }).click();
  await expect(first.getByTestId('smoke-count')).toHaveText('1');
});
