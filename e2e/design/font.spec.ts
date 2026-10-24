import { expect, test } from '@playwright/test';

// CA-06 (SPEC-0003): Sora is self-hosted, precached and works offline; no Google Fonts.
test('Sora loads offline from the own origin and never from Google Fonts', async ({
  page,
  context,
  baseURL,
}) => {
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));

  await page.goto('./');
  await expect(page.getByTestId('smoke-count')).toHaveText('0');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('smoke-count')).toHaveText('0');
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('600 16px Sora');
    return faces.filter((face) => face.status === 'loaded').length;
  });
  expect(loaded).toBeGreaterThanOrEqual(1);

  const ownOrigin = new URL('/start/', baseURL).href;
  const fonts = requests.filter((url) => /\.woff2($|\?)/.test(url));
  expect(fonts.some((url) => url.includes('sora-latin-600-normal'))).toBe(true);
  expect(fonts.filter((url) => !url.startsWith(ownOrigin))).toEqual([]);
  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
