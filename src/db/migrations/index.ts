import { loadMigrations } from '../migrate';

/** The app's migrations, bundled as text. Node tests read the same files with node:fs. */
export const migrations = loadMigrations(
  import.meta.glob<string>('./*.sql', { query: '?raw', import: 'default', eager: true }),
);
