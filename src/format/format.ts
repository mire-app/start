const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
});

const date = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formats an amount in euros with es-ES conventions, e.g. `1.234,56 €` (NBSP before €). */
export function formatEUR(n: number): string {
  return eur.format(n);
}

/** Formats a `YYYY-MM-DD` date (no time, no time zone) as `DD/MM/YYYY`. */
export function formatDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate);
  if (!m) throw new RangeError(`Invalid ISO date: ${isoDate}`);
  return date.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}
