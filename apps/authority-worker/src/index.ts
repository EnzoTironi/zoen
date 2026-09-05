/**
 * Authority worker entry — source/interpretation/release/attention jobs.
 * Composition roots may bind admitted adapters; no provider success stubs.
 */
export const AUTHORITY_WORKER_BOUNDARY = {
  package: 'apps/authority-worker',
  mayImport: ['packages/ontology', 'packages/adapters', 'packages/contracts', 'packages/kernel'] as const,
} as const;
