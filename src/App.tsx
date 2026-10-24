import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DbError } from './db/client';
import { SmokeStore } from './db/smoke';
import { LANGUAGES } from './i18n';

type StorageState =
  | { status: 'opening' }
  | { status: 'ready'; store: SmokeStore; count: number }
  | { status: 'busy' }
  | { status: 'error' };

export default function App() {
  const { t, i18n } = useTranslation();
  const [storage, setStorage] = useState<StorageState>({ status: 'opening' });

  useEffect(() => {
    let cancelled = false;
    SmokeStore.open()
      .then(async (store) => {
        const count = await store.count();
        if (!cancelled) setStorage({ status: 'ready', store, count });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStorage({ status: err instanceof DbError && err.code === 'busy' ? 'busy' : 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function testStorage() {
    if (storage.status !== 'ready') return;
    const count = await storage.store.increment();
    setStorage({ ...storage, count });
  }

  return (
    <>
      <header>
        <h1>Míre</h1>
        <label>
          {t('language.label')}{' '}
          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
          >
            {LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {t(`language.${lng}`)}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main>
        <h2>{t('home.title')}</h2>
        <section aria-labelledby="storage-title">
          <h3 id="storage-title">{t('storage.title')}</h3>
          {storage.status === 'busy' && <p role="alert">{t('storage.busy')}</p>}
          {storage.status === 'error' && <p role="alert">{t('storage.error')}</p>}
          <p>
            {t('storage.count')}:{' '}
            <output data-testid="smoke-count">
              {storage.status === 'ready' ? storage.count : '—'}
            </output>
          </p>
          <button
            type="button"
            disabled={storage.status !== 'ready'}
            onClick={() => void testStorage()}
          >
            {t('storage.test')}
          </button>
        </section>
      </main>
    </>
  );
}
