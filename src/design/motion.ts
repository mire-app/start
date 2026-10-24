import { flushSync } from 'react-dom';

/** Motion tokens (SPEC-0003 §8), in milliseconds. Same values as the --motion-* CSS variables. */
export const duration = { fast: 150, base: 250, slow: 350 } as const;

/** Easing curve cubic-bezier(.2,.7,.2,1), as Motion expects it. */
export const easing = [0.2, 0.7, 0.2, 1] as const;

export type Direction = 'forward' | 'back';

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Directional slide between main screens. `update` changes the screen (it runs inside
 * `flushSync`, so React state updates are applied synchronously). Without View Transitions
 * support, or when reduced motion is requested, `update` runs directly without animation.
 */
export function navigate(direction: Direction, update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  const className = `vt-${direction}`;
  root.classList.remove('vt-forward', 'vt-back');
  root.classList.add(className);
  const transition = document.startViewTransition(() => flushSync(update));
  transition.finished
    .catch(() => {
      // The update failed or the transition was skipped: the screen state is what it is.
    })
    .finally(() => root.classList.remove(className));
}
