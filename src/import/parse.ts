/** Reading amounts, dates and texts from imported files (SPEC-0004 §7; used by SPEC-0011/0012). */

export type AmountResult = { ok: true; cents: number } | { ok: false; code: 'invalid_amount' };
export type DateResult = { ok: true; date: string } | { ok: false; code: 'invalid_date' };
export type DateFormat = 'dd/mm/aaaa' | 'dd-mm-aaaa' | 'aaaa-mm-dd' | 'mm/dd/aaaa';

const MINUS_SIGN = String.fromCharCode(0x2212);
const INVALID_AMOUNT: AmountResult = { ok: false, code: 'invalid_amount' };
const INVALID_DATE: DateResult = { ok: false, code: 'invalid_date' };

/**
 * Rounds a non-negative decimal string ("1967.835") to cents once, half away from zero, without
 * floating point.
 */
function decimalToCents(integer: string, fraction: string, negative: boolean): AmountResult {
  const digits = fraction.padEnd(3, '0');
  let cents = Number(integer) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return INVALID_AMOUNT;
  return { ok: true, cents: negative && cents !== 0 ? -cents : cents };
}

/**
 * Amount in cents. Numbers (Excel cells) always use a dot; texts use `decimal` and the other
 * separator for thousands, grouped in threes. Spaces, NBSP and € are ignored.
 */
export function parseAmount(input: string | number, decimal: ',' | '.' = ','): AmountResult {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return INVALID_AMOUNT;
    const match = /^(\d+)\.(\d+)$/.exec(Math.abs(input).toFixed(6));
    if (!match) return INVALID_AMOUNT;
    return decimalToCents(match[1]!, match[2]!, input < 0);
  }
  const text = input.replace(/[\s€]/g, '');
  const thousands = decimal === ',' ? '\\.' : ',';
  const pattern = new RegExp(
    `^([+\\-${MINUS_SIGN}]?)(\\d{1,3}(?:${thousands}\\d{3})+|\\d+)(?:\\${decimal}(\\d+))?$`,
  );
  const match = pattern.exec(text);
  if (!match) return INVALID_AMOUNT;
  const integer = match[2]!.replace(/[.,]/g, '');
  return decimalToCents(integer, match[3] ?? '', match[1] === '-' || match[1] === MINUS_SIGN);
}

const DATE_PATTERNS: Record<DateFormat, { re: RegExp; order: [number, number, number] }> = {
  // order: indexes of year, month and day in the match.
  'dd/mm/aaaa': { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [3, 2, 1] },
  'dd-mm-aaaa': { re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: [3, 2, 1] },
  'aaaa-mm-dd': { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [1, 2, 3] },
  'mm/dd/aaaa': { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [3, 1, 2] },
};

function isoDate(year: number, month: number, day: number): DateResult {
  if (month < 1 || month > 12 || day < 1) return INVALID_DATE;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return INVALID_DATE;
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return { ok: true, date: `${pad(year, 4)}-${pad(month)}-${pad(day)}` };
}

/** Business date as YYYY-MM-DD. A Date (ExcelJS cell) is read by its UTC components. */
export function parseDate(input: string | Date, format: DateFormat): DateResult {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return INVALID_DATE;
    return isoDate(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate());
  }
  const { re, order } = DATE_PATTERNS[format];
  const match = re.exec(input.trim());
  if (!match) return INVALID_DATE;
  const [y, m, d] = order.map((i) => Number(match[i]));
  return isoDate(y!, m!, d!);
}

/** For comparisons: no diacritics, upper case, single spaces, trimmed. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
