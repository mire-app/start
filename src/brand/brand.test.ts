import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// CA-07: the generated logo SVGs are paths only, without <text>.
describe('logo SVGs', () => {
  const dir = new URL('./', import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith('.svg'));

  it('has the three logo variants', () => {
    expect(files.sort()).toEqual(['logo-dark.svg', 'logo-light.svg', 'logo-on-top.svg']);
  });

  for (const name of files) {
    it(`${name} has paths and no <text>`, () => {
      const svg = readFileSync(new URL(name, dir), 'utf8');
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<text[\s>]/i);
    });
  }
});
