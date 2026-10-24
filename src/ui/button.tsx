import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-colors duration-(--motion-fast) ease-mire disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand hover-brand',
        secondary: 'border border-accent bg-transparent text-accent hover-accent',
        ghost: 'bg-transparent text-text hover:not-disabled:bg-track',
      },
      size: {
        // 44 px; «compact» is 36 px from 640 px up and keeps 44 px touch targets on mobile.
        default: 'h-11 px-5 text-base',
        compact: 'h-11 px-4 text-sm sm:h-9',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
