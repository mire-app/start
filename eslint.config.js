import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '.cache'] },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // SPEC-0004 §1: writes go through the worker. Outside src/db/ only client.ts is used, plus
    // the SqlDb type for code the worker runs (e.g. src/import/).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/db/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)db/(worker|sql)([.-][^/]*)?$',
              allowTypeImports: true,
              message:
                'Use src/db/client.ts; only `import type` is allowed from the worker and sql.',
            },
          ],
        },
      ],
    },
  },
);
