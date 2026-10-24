import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

/** Flattens nested translation keys to `a.b.c` paths with their values. */
function flatten(tree: object, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of flatten(value as object, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

// CA-10 (SPEC-0003): every text exists in Spanish and in English.
describe('translations', () => {
  const keys = { es: flatten(es), en: flatten(en) };

  it('has the same keys in es.json and en.json', () => {
    const missingInEn = [...keys.es.keys()].filter((k) => !keys.en.has(k));
    const missingInEs = [...keys.en.keys()].filter((k) => !keys.es.has(k));
    expect({ missingInEn, missingInEs }).toEqual({ missingInEn: [], missingInEs: [] });
  });

  it('has no empty texts', () => {
    for (const [lang, map] of Object.entries(keys)) {
      for (const [key, value] of map) {
        expect(typeof value === 'string' && value.trim() !== '', `${lang}: ${key}`).toBe(true);
      }
    }
  });
});
