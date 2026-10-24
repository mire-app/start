import { expect, test } from '@playwright/test';

// CA-07 (SPEC-0003): definitive manifest, app icons and favicons.
test('the manifest declares Míre, its theme colour and the 192, 512 and maskable icons', async ({
  page,
  request,
}) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, page.url());
  const manifest = await (await request.get(manifestUrl.href)).json();

  expect(manifest).toMatchObject({ name: 'Míre', theme_color: '#0B132B' });
  const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
  expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(icons.some((icon) => icon.purpose?.split(' ').includes('maskable'))).toBe(true);
  for (const icon of icons) {
    const response = await request.get(new URL(icon.src, manifestUrl).href);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('index.html links favicon.svg and favicon-32.png', async ({ page, request }) => {
  await page.goto('./');
  const hrefs = await page
    .locator('link[rel="icon"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));

  for (const name of ['favicon.svg', 'favicon-32.png']) {
    const href = hrefs.find((url) => url.endsWith(`/${name}`));
    expect(href, name).toBeTruthy();
    expect((await request.get(href!)).ok(), name).toBe(true);
  }
});
