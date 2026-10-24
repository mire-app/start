import type { ReactNode } from 'react';
import logo from '@/brand/logo-on-top.svg';

interface TopBarProps {
  title: string;
  /** Icon buttons on the right, on the `top` background. */
  actions?: ReactNode;
}

/**
 * Top bar with the logo, the screen title and actions. It stays fixed during the directional
 * slide (view-transition-name: topbar). The logo is 24 px high (68 px wide, above the 64 px
 * minimum) with clear space of at least the height of the M around it.
 */
export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-top text-on-top [view-transition-name:topbar]">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-5 px-5">
        <img src={logo} alt="Míre" width={68} height={24} className="h-6 w-auto shrink-0" />
        <h1 className="min-w-0 flex-1 truncate text-lg leading-[1.2] font-semibold">{title}</h1>
        {actions && <div className="-mr-2 flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}

/** Class names for icon buttons placed on the top bar. */
export const topBarActionClass = 'text-on-top hover:not-disabled:bg-on-top/10';
