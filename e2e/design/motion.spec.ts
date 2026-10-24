import { expect, test, type Page } from '@playwright/test';

// CA-08 (SPEC-0003): the directional slide uses View Transitions unless reduced motion is asked.
interface Spy {
  calls: number;
  forwardClass: boolean[];
}

/** Wraps document.startViewTransition to count calls and record the <html> class at each call. */
function installSpy() {
  const spy: Spy = { calls: 0, forwardClass: [] };
  (window as unknown as { viewTransitionSpy: Spy }).viewTransitionSpy = spy;
  const original = document.startViewTransition;
  if (typeof original !== 'function') return;
  document.startViewTransition = function (this: Document, ...args) {
    spy.calls += 1;
    spy.forwardClass.push(document.documentElement.classList.contains('vt-forward'));
    return original.apply(this, args);
  } as typeof document.startViewTransition;
}

function readSpy(page: Page): Promise<Spy> {
  return page.evaluate(() => (window as unknown as { viewTransitionSpy: Spy }).viewTransitionSpy);
}

async function openDemo(page: Page) {
  await page.addInitScript(installSpy);
  await page.goto('./estilo.html');
  const panel = page.getByTestId('motion-panel');
  await expect(panel).toHaveText('Panel 1 de 2');
  return panel;
}

test.describe('without reduced motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('«Siguiente» starts one view transition with the vt-forward class', async ({ page }) => {
    const panel = await openDemo(page);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

    await expect(panel).toHaveText('Panel 2 de 2');
    expect(await readSpy(page)).toEqual({ calls: 1, forwardClass: [true] });
    await expect(page.locator('html')).not.toHaveClass(/vt-forward/);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('«Siguiente» changes the panel without a view transition', async ({ page }) => {
    const panel = await openDemo(page);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

    await expect(panel).toHaveText('Panel 2 de 2');
    expect(await readSpy(page)).toEqual({ calls: 0, forwardClass: [] });
  });
});
