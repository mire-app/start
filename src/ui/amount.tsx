import { formatEUR } from '@/format/format';
import { cn } from './cn';

export type AmountKind = 'income' | 'expense' | 'transfer' | 'balance';

const MINUS = '\u2212';

const KIND_CLASS: Record<AmountKind, string> = {
  income: 'text-positive',
  expense: 'text-negative',
  transfer: 'text-muted',
  balance: 'text-text',
};

interface AmountProps {
  value: number;
  kind: AmountKind;
  className?: string;
}

/**
 * Amount in euros (SPEC-0003 §3). The sign never depends on colour alone (WCAG 1.4.1):
 * income `+`, expense `−` (U+2212, from a positive or negative value), transfer without sign,
 * balance `−` only when negative.
 */
export function Amount({ value, kind, className }: AmountProps) {
  let sign = '';
  if (kind === 'income') sign = '+';
  else if (kind === 'expense' || (kind === 'balance' && value < 0)) sign = MINUS;
  return (
    <span data-kind={kind} className={cn('tabular-nums', KIND_CLASS[kind], className)}>
      {sign + formatEUR(Math.abs(value))}
    </span>
  );
}
