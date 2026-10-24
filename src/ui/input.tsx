import type { ComponentProps } from 'react';
import { cn } from './cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full min-w-0 rounded-control border border-border-input bg-surface px-3 text-base text-text placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
