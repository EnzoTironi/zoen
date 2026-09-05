/**
 * ZN-0003 boundary rules (Eve/web/kernel import isolation).
 * Style/format lint is Ultracite + Oxlint (`oxlint.config.ts`). This ESLint
 * flat config remains because `tooling/workspace.ts check` requires it and
 * encodes repository-contract edges; it is not the primary formatter.
 */
const eveRestricted = [
  'pg',
  'packages/adapters/src/pg',
  'packages/adapters/src/pg.js',
  '@zoen/adapters/pg',
];

const webRestricted = [
  ...eveRestricted,
  // Authority / source credential env keys must not be read from web
];

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['packages/eve/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: eveRestricted.map((name) => ({
            name,
            message: 'Eve must not import PostgreSQL adapter or authority credentials (ZN-0003).',
          })),
          patterns: [
            {
              group: ['**/adapters/**/pg*', '**/adapters/src/pg*'],
              message: 'Eve must not import PostgreSQL adapter (ZN-0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: webRestricted.map((name) => ({
            name,
            message: 'Web must not hold authority/source credentials or raw pg (ZN-0003).',
          })),
          patterns: [
            {
              group: ['**/adapters/**/pg*', '**/adapters/src/pg*'],
              message: 'Web must not import PostgreSQL adapter (ZN-0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/kernel/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: 'Kernel must not import pg.' },
            { name: 'hono', message: 'Kernel must not import hono.' },
            { name: 'node:fs', message: 'Kernel must not read filesystem.' },
            { name: 'node:net', message: 'Kernel must not open network sockets.' },
            { name: 'node:http', message: 'Kernel must not open HTTP clients.' },
          ],
          patterns: [{ group: ['**/apps/**'], message: 'Kernel must not import apps.' }],
        },
      ],
    },
  },
];
