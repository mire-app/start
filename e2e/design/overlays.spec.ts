import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// CA-04 and CA-09 (SPEC-0003) beyond the closed pages: overlays open, and the 375 px viewport.
async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    targets: v.nodes.map((node) => node.target.join(' ')),
  }));
}

/** Waits for the `fast` enter animation of an overlay to end. */
const settle = (page: Page) => page.waitForTimeout(300);

for (const scheme of ['light', 'dark'] as const) {
  test(`style guide overlays have no accessibility violations in the ${scheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./estilo.html');
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

    await page.getByRole('button', { name: 'Abrir diálogo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Deshacer importación' });
    await expect(dialog).toBeVisible();
    await settle(page);
    expect(await violations(page), 'dialog').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Más opciones' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeFocused();
    await settle(page);
    expect(await violations(page), 'menu').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();

    await page.getByRole('button', { name: 'Mostrar aviso de error' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'No se ha podido leer' }),
    ).toBeVisible();
    await settle(page);
    expect(await violations(page), 'toast').toEqual([]);

    await page.getByRole('button', { name: 'Información' }).focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await settle(page);
    expect(await violations(page), 'tooltip').toEqual([]);
  });
}

test.describe('at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const [name, url] of [
    ['home screen', './'],
    ['style guide', './estilo.html'],
  ] as const) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(url);
      if (url === './') await expect(page.getByTestId('smoke-count')).toHaveText('0');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await violations(page)).toEqual([]);
    });
  }
});
