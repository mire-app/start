import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
  {
    variants: {
      variant: {
        neutral: 'border-transparent bg-track text-text',
        positive: 'border-positive bg-surface text-positive',
        negative: 'border-negative bg-surface text-negative',
        gold: 'border-gold bg-surface text-gold',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
