/**
 * ZN-0003 dependency-cruiser rules — repository-contract import directions.
 * dependency-cruiser npm package is not in the ZN-0002 core lock;
 * tooling/workspace.ts enforces equivalent edges. This is the reviewed config.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'eve-no-pg-adapter',
      severity: 'error',
      comment: 'Eve cannot access pg / S3 evidence credentials (repository-contract).',
      from: { path: '^packages/eve' },
      to: { path: '(^pg$)|(/adapters/src/pg)|(@zoen/adapters/pg)' },
    },
    {
      name: 'web-no-authority-adapter',
      severity: 'error',
      comment: 'Web never holds source/provider secrets or raw pg.',
      from: { path: '^apps/web' },
      to: { path: '(^pg$)|(/adapters/src/pg)|(/adapters/src/config)' },
    },
    {
      name: 'kernel-no-application-io',
      severity: 'error',
      comment: 'Kernel imports no application code, network client, database or provider library.',
      from: { path: '^packages/kernel' },
      to: { path: '(^pg$)|(^hono$)|(^apps/)|(node:fs)|(node:net)|(node:http)' },
    },
    {
      name: 'eve-worker-no-authority-db',
      severity: 'error',
      comment: 'Eve worker: turn-state execution, no authority database credentials.',
      from: { path: '^apps/eve-worker' },
      to: { path: '(/adapters/src/pg)|(/adapters/src/config)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
