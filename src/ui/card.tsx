import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Cards are separated by the `line` border, without shadow (SPEC-0003 §5). */
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-card border border-line bg-surface p-4 text-text sm:p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('mb-4 text-lg leading-tight font-semibold', className)} {...props} />;
}
