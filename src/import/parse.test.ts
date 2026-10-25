import { describe, expect, it } from 'vitest';
import { normalizeText, parseAmount, parseDate } from './parse';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

describe('CA-03 · parseAmount', () => {
  it.each<[string | number, number]>([
    ['10,81€', 1081],
    ['-51,56', -5156],
    [`${MINUS}1.234,50 €`, -123450],
    ['1.967,8300 €', 196783],
    ['1.967,8350 €', 196784],
    ['-1.967,8350 €', -196784],
    [-51.56, -5156],
    [1234.5, 123450],
    [`1.234,56${NBSP}€`, 123456],
    ['+7', 700],
  ])('%s → %i', (input, cents) => {
    expect(parseAmount(input, ',')).toEqual({ ok: true, cents });
  });

  it('a dot decimal makes the comma the thousands separator', () => {
    expect(parseAmount('1,234.50', '.')).toEqual({ ok: true, cents: 123450 });
  });

  it('numbers always use a dot, whatever the decimal separator', () => {
    expect(parseAmount(-51.56)).toEqual({ ok: true, cents: -5156 });
    expect(parseAmount(0.005, '.')).toEqual({ ok: true, cents: 1 });
  });

  it.each(['12,34,56', '1.23,45', 'abc', '', '1,2.3', '--5', NaN, Infinity])(
    '%s is invalid',
    (input) => {
      expect(parseAmount(input)).toEqual({ ok: false, code: 'invalid_amount' });
    },
  );
});

describe('CA-04 · parseDate', () => {
  it('reads texts in the given format', () => {
    expect(parseDate('24/10/2026', 'dd/mm/aaaa')).toEqual({ ok: true, date: '2026-10-24' });
    expect(parseDate('2026-10-24', 'aaaa-mm-dd')).toEqual({ ok: true, date: '2026-10-24' });
    expect(parseDate('24-10-2026', 'dd-mm-aaaa')).toEqual({ ok: true, date: '2026-10-24' });
    expect(parseDate('10/24/2026', 'mm/dd/aaaa')).toEqual({ ok: true, date: '2026-10-24' });
  });

  it('impossible dates are invalid', () => {
    expect(parseDate('31/02/2026', 'dd/mm/aaaa')).toEqual({ ok: false, code: 'invalid_date' });
    expect(parseDate('29/02/2026', 'dd/mm/aaaa')).toEqual({ ok: false, code: 'invalid_date' });
    expect(parseDate('29/02/2028', 'dd/mm/aaaa')).toEqual({ ok: true, date: '2028-02-29' });
    expect(parseDate('2026-10-24', 'dd/mm/aaaa')).toEqual({ ok: false, code: 'invalid_date' });
  });

  it('reads a Date by its UTC components in any time zone', () => {
    expect(parseDate(new Date(Date.UTC(2026, 9, 24)), 'dd/mm/aaaa')).toEqual({
      ok: true,
      date: '2026-10-24',
    });
  });
});

describe('normalizeText', () => {
  it('removes diacritics, upper-cases and collapses spaces', () => {
    expect(normalizeText(`  Café   de la${NBSP}Peña `)).toBe('CAFE DE LA PENA');
  });
});
