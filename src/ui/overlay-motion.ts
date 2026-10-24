import { useReducedMotion, type MotionProps } from 'motion/react';
import { duration, easing } from '@/design/motion';

/**
 * Enter and exit of dialogs, menus and toasts (SPEC-0003 §8): fade and scale 0.98 → 1 in `fast`;
 * only the fade when reduced motion is requested.
 */
export function useOverlayMotion(): MotionProps {
  const reduce = useReducedMotion();
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 };
  return {
    initial: hidden,
    animate: { opacity: 1, scale: 1 },
    exit: hidden,
    transition: { duration: duration.fast / 1000, ease: easing },
  };
}

/** Fade only, for backdrops. */
export const fadeMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.fast / 1000, ease: easing },
};
