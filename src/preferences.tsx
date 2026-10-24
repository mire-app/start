import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { THEME_CHOICES, useThemeChoice, type ThemeChoice } from './design/theme';
import { LANGUAGES } from './i18n';
import { Select } from './ui/select';

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Language selector (SPEC-0002): its accessible name is «Idioma» / «Language». */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <Field label={t('language.label')} id={id}>
      <Select
        id={id}
        value={i18n.resolvedLanguage}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Theme selector (SPEC-0003 §7): «Tema» / «Theme», with System, Light and Dark. */
export function ThemeSelect() {
  const { t } = useTranslation();
  const id = useId();
  const [choice, setChoice] = useThemeChoice();
  return (
    <Field label={t('theme.label')} id={id}>
      <Select id={id} value={choice} onChange={(e) => setChoice(e.target.value as ThemeChoice)}>
        {THEME_CHOICES.map((value) => (
          <option key={value} value={value}>
            {t(`theme.${value}`)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
