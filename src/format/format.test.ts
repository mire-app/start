import { describe, expect, it } from 'vitest';
import { formatDate, formatEUR } from './format';

describe('formatEUR', () => {
  it('groups thousands and puts a NBSP before €', () => {
    expect(formatEUR(1234.56)).toBe('1.234,56 €');
  });

  it('formats negative amounts', () => {
    expect(formatEUR(-5)).toBe('-5,00 €');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as DD/MM/YYYY regardless of TZ', () => {
    expect(formatDate('2026-10-24')).toBe('24/10/2026');
  });
});
