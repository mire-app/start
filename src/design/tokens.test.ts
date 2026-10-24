import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';
import { THEMES, tokens, type TokenName } from './tokens';

// SPEC-0003 §2, table of colour tokens: [light, dark].
const SPEC_TABLE: Record<TokenName, [string, string]> = {
  bg: ['#F8FAFC', '#0B132B'],
  surface: ['#FFFFFF', '#131D3D'],
  text: ['#0B132B', '#E8ECF5'],
  muted: ['#4A5570', '#A3AECA'],
  line: ['#DDE3EC', '#253256'],
  'border-input': ['#7C879E', '#6576A0'],
  top: ['#0B132B', '#131D3D'],
  'on-top': ['#F8FAFC', '#E8ECF5'],
  brand: ['#0B132B', '#E8ECF5'],
  'on-brand': ['#F8FAFC', '#0B132B'],
  accent: ['#2B4C9B', '#8DA9F0'],
  positive: ['#047857', '#34D399'],
  negative: ['#B4483C', '#F29B8F'],
  gold: ['#7A5D10', '#E5C158'],
  'gold-fill': ['#E5C158', '#E5C158'],
  'emerald-fill': ['#10B981', '#10B981'],
  focus: ['#047857', '#34D399'],
  track: ['#E4E9F1', '#253256'],
  'chart-1': ['#A7E8CF', '#14503F'],
  'chart-2': ['#7FDDB9', '#176A52'],
  'chart-3': ['#4FCF9F', '#1A8565'],
  'chart-4': ['#10B981', '#10B981'],
  'chart-5': ['#0E9F6E', '#34D399'],
  'chart-6': ['#047857', '#6EE7B7'],
};

function expected(theme: 'light' | 'dark'): Record<string, string> {
  const index = theme === 'light' ? 0 : 1;
  return Object.fromEntries(
    Object.entries(SPEC_TABLE).map(([name, values]) => [name, values[index]]),
  );
}

function upper(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.toUpperCase()]));
}

/** Reads the `--color-*: #RRGGBB` declarations of the first CSS block matched by `opening`. */
function cssColours(css: string, opening: RegExp): Record<string, string> {
  const start = css.search(opening);
  expect(start, `block ${opening} not found in tokens.css`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const colours: Record<string, string> = {};
  for (const m of body.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    colours[m[1]!] = m[2]!.toUpperCase();
  }
  return colours;
}

describe('CA-02: tokens.ts and tokens.css match the table of SPEC-0003', () => {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const blocks = {
    light: cssColours(css, /@theme\s+static\s*\{/),
    dark: cssColours(css, /\[data-theme=['"]dark['"]\]\s*\{/),
  };

  for (const theme of THEMES) {
    it(`tokens.ts has the ${theme} values`, () => {
      expect(upper(tokens[theme])).toEqual(expected(theme));
    });

    it(`tokens.css has the ${theme} values`, () => {
      expect(blocks[theme]).toEqual(expected(theme));
    });
  }
});

describe('CA-01: WCAG 2.2 AA contrast of the tokens', () => {
  for (const theme of THEMES) {
    const t = tokens[theme];

    for (const name of ['text', 'muted', 'accent', 'positive', 'negative', 'gold'] as const) {
      for (const background of ['bg', 'surface'] as const) {
        it(`${theme}: ${name} on ${background} is at least 4.5:1`, () => {
          expect(contrast(t[name], t[background])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    it(`${theme}: on-top on top and on-brand on brand are at least 4.5:1`, () => {
      expect(contrast(t['on-top'], t.top)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['on-brand'], t.brand)).toBeGreaterThanOrEqual(4.5);
    });

    for (const name of ['border-input', 'focus'] as const) {
      for (const background of ['bg', 'surface'] as const) {
        it(`${theme}: ${name} on ${background} is at least 3:1`, () => {
          expect(contrast(t[name], t[background])).toBeGreaterThanOrEqual(3);
        });
      }
    }
  }

  it('computes known ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBe(1);
  });
});
