import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        // The ::after box extends the touch target to 44 px high.
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border-input bg-track transition-colors duration-(--motion-fast) after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-positive data-[state=checked]:bg-positive",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-1 rounded-full bg-surface shadow-[0_0_0_1px_var(--color-border-input)] transition-transform duration-(--motion-fast) ease-mire data-[state=checked]:translate-x-5.5 data-[state=checked]:shadow-none" />
    </SwitchPrimitive.Root>
  );
}
