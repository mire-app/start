import { useEffect, useState } from 'react';
import type { Theme } from './tokens';

/**
 * Theme choice (SPEC-0003 §7): «system» follows prefers-color-scheme. The resolved theme goes to
 * `data-theme` on <html>; the inline script in index.html and estilo.html applies it before the
 * first paint with the same rules, so keep both in sync.
 */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const STORAGE_KEY = 'mire.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice);
}

export function storedThemeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice;
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
}

/** Current theme choice and a setter that persists it and applies it to the page. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(storedThemeChoice);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== 'system') return;
    const query = matchMedia(DARK_QUERY);
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  function update(next: ThemeChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts only for this page.
    }
    setChoice(next);
  }

  return [choice, update];
}
