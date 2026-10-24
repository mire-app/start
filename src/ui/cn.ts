import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the custom scales of tokens.css and index.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['control', 'card'],
      shadow: ['overlay'],
      ease: ['mire'],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (the last class wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
