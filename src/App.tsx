import ErrorIcon from '@material-symbols/svg-400/rounded/error.svg?react';
import InfoIcon from '@material-symbols/svg-400/rounded/info.svg?react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { call, DbError, type Result } from './db/client';
import { SmokeStore } from './db/smoke';
import { LanguageSelect, ThemeSelect } from './preferences';
import { Button } from './ui/button';
import { Card, CardTitle } from './ui/card';
import { Icon } from './ui/icon';
import { TopBar } from './ui/top-bar';

type StorageState =
  | { status: 'opening' }
  | { status: 'ready'; store: SmokeStore; count: number }
  | { status: 'busy' }
  | { status: 'error' };

type DbVersion = Result<'schemaVersion'>;

export default function App() {
  const { t } = useTranslation();
  const [storage, setStorage] = useState<StorageState>({ status: 'opening' });
  // undefined while opening; null if /mire.sqlite3 has no version (it failed to migrate).
  const [dbVersion, setDbVersion] = useState<DbVersion | undefined>();

  useEffect(() => {
    let cancelled = false;
    SmokeStore.open()
      .then(async (store) => {
        const count = await store.count();
        if (!cancelled) setStorage({ status: 'ready', store, count });
        const version = await call('schemaVersion', {}).catch(() => null);
        if (!cancelled) setDbVersion(version);
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
      <TopBar title={t('home.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <Card aria-labelledby="preferences-title">
          <CardTitle id="preferences-title">{t('home.preferences')}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <LanguageSelect />
            <ThemeSelect />
          </div>
        </Card>
        <Card aria-labelledby="storage-title">
          <CardTitle id="storage-title">{t('storage.title')}</CardTitle>
          {storage.status === 'busy' && (
            <p role="alert" className="mb-4 flex items-start gap-2 text-text">
              <Icon icon={InfoIcon} className="text-accent" />
              <span className="pt-px">{t('storage.busy')}</span>
            </p>
          )}
          {(storage.status === 'error' || (storage.status === 'ready' && dbVersion === null)) && (
            <p role="alert" className="mb-4 flex items-start gap-2 text-negative">
              <Icon icon={ErrorIcon} />
              <span className="pt-px">{t('storage.error')}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p>
                <span className="text-muted">{t('storage.count')}:</span>{' '}
                <output data-testid="smoke-count" className="font-semibold tabular-nums">
                  {storage.status === 'ready' ? storage.count : '—'}
                </output>
              </p>
              <p>
                <span className="text-muted">{t('storage.dbVersion')}</span>{' '}
                <output
                  data-testid="db-version"
                  data-applied-at={dbVersion?.appliedAt}
                  className="font-semibold tabular-nums"
                >
                  {dbVersion?.version ?? '—'}
                </output>
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={storage.status !== 'ready'}
              onClick={() => void testStorage()}
            >
              {t('storage.test')}
            </Button>
          </div>
        </Card>
      </main>
    </>
  );
}
