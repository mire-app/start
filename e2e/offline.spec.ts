import { expect, test } from '@playwright/test';

// CA-07: after a first visit the app reloads and works offline (wasm and worker precached).
test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByTestId('smoke-count')).toHaveText('0');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  const count = page.getByTestId('smoke-count');
  await expect(count).toHaveText('0');
  await page.getByRole('button', { name: 'Probar almacenamiento' }).click();
  await expect(count).toHaveText('1');
});

test('links a valid PWA manifest', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();

  expect(manifest).toMatchObject({
    name: 'Míre',
    start_url: '/start/',
    scope: '/start/',
    display: 'standalone',
  });
  const sizes = (manifest.icons as { sizes: string }[]).map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
});
