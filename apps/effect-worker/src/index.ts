/**
 * Effect worker entry — Restate adapter; narrow execution, no policy invention.
 */
export const EFFECT_WORKER_BOUNDARY = {
  package: 'apps/effect-worker',
  mayImport: ['packages/ontology', 'packages/contracts', 'packages/kernel'] as const,
  mustNotInventPolicy: true,
} as const;
