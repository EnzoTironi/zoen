/**
 * Eve worker entry — turn-state execution.
 * Forbidden: authority database credentials and raw pg authority pools.
 */
export const EVE_WORKER_BOUNDARY = {
  package: 'apps/eve-worker',
  mayImport: ['packages/eve', 'packages/contracts', 'packages/kernel', 'packages/clients'] as const,
  mustNotImport: ['pg', 'packages/adapters/src/pg', 'packages/adapters/src/config'] as const,
} as const;
