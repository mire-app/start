// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Amount, type AmountKind } from './amount';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

afterEach(cleanup);

// CA-03: exact texts, data-kind and colour token class of each kind.
const CASES: [value: number, kind: AmountKind, text: string, tokenClass: string][] = [
  [2350, 'income', `+2.350,00${NBSP}€`, 'text-positive'],
  [-84.2, 'expense', `${MINUS}84,20${NBSP}€`, 'text-negative'],
  [500, 'transfer', `500,00${NBSP}€`, 'text-muted'],
  [-1000, 'balance', `${MINUS}1.000,00${NBSP}€`, 'text-text'],
];

describe('Amount', () => {
  for (const [value, kind, text, tokenClass] of CASES) {
    it(`renders ${kind} ${value}`, () => {
      const { container } = render(<Amount value={value} kind={kind} />);
      const span = container.firstElementChild as HTMLElement;
      expect(span.tagName).toBe('SPAN');
      expect(span.textContent).toBe(text);
      expect(span.dataset.kind).toBe(kind);
      expect(span.classList.contains(tokenClass)).toBe(true);
    });
  }

  it('shows an expense given as a positive value with the minus sign', () => {
    const { container } = render(<Amount value={84.2} kind="expense" />);
    expect(container.textContent).toBe(`${MINUS}84,20${NBSP}€`);
  });

  it('shows a positive balance without sign', () => {
    const { container } = render(<Amount value={48215.3} kind="balance" />);
    expect(container.textContent).toBe(`48.215,30${NBSP}€`);
  });
});
