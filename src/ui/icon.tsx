import type { ComponentType, SVGProps } from 'react';
import { cn } from './cn';

/** A Material Symbols Rounded icon imported as `…/rounded/<name>.svg?react` (SPEC-0003 §6). */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface IconProps {
  icon: IconComponent;
  size?: 20 | 24;
  className?: string;
}

/** Decorative icon in `currentColor`. Icon-only buttons carry the label themselves. */
export function Icon({ icon: Svg, size = 24, className }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    />
  );
}
