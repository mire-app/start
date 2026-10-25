import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('CA-10 · writes go through src/db/', () => {
  const eslint = new ESLint({ cwd: root });
  const lint = async (code: string) => {
    const [result] = await eslint.lintText(code, { filePath: 'src/ui/x.ts' });
    return result!.messages.filter((m) => m.ruleId?.endsWith('no-restricted-imports'));
  };

  it('importing a value from @/db/sql outside src/db/ is an error', async () => {
    const messages = await lint("import { x } from '@/db/sql';\nexport { x };\n");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.severity).toBe(2);
  });

  it('importing a value from the worker by a relative path is an error', async () => {
    expect(await lint("import { x } from '../db/worker';\nexport { x };\n")).toHaveLength(1);
  });

  it('importing the SqlDb type is allowed', async () => {
    expect(await lint("import type { SqlDb } from '@/db/sql';\nexport type T = SqlDb;\n")).toEqual(
      [],
    );
  });

  it('there is no SQL that writes outside src/db/', () => {
    const grep = spawnSync(
      'git',
      [
        'grep',
        '-nE',
        String.raw`\b(INSERT|UPDATE|DELETE)\b`,
        '--',
        'src',
        ':!src/db',
        ':!**/*.test.*',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(grep.error).toBeUndefined();
    expect(grep.stdout).toBe('');
    // git grep exits with 1 when nothing matches.
    expect(grep.status).toBe(1);
  });
});
