import ArrowDownIcon from '@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?react';
import type { ComponentProps } from 'react';
import { cn } from './cn';
import { Icon } from './icon';

/** Native <select> with the design system look: the system picker stays (Android). */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <select
        className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-control border border-border-input bg-surface pr-10 pl-3 text-base text-text disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <Icon
        icon={ArrowDownIcon}
        size={20}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
