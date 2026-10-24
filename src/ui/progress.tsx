import * as ProgressPrimitive from '@radix-ui/react-progress';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

interface ProgressProps {
  /** 0 to 100. */
  value: number;
  /** Accessible name of the bar. */
  label: string;
  className?: string;
}

/** Progress bar with a 1 px `border-input` border and its value in text (WCAG 1.4.11). */
export function Progress({ value, label, className }: ProgressProps) {
  const { i18n } = useTranslation();
  const clamped = Math.min(100, Math.max(0, value));
  const text = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(clamped / 100);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ProgressPrimitive.Root
        value={clamped}
        aria-label={label}
        getValueLabel={() => text}
        className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border border-border-input bg-track"
      >
        <ProgressPrimitive.Indicator
          className="h-full w-full bg-gold-fill transition-transform duration-(--motion-base) ease-mire"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </ProgressPrimitive.Root>
      <span aria-hidden="true" className="text-sm text-text tabular-nums">
        {text}
      </span>
    </div>
  );
}
