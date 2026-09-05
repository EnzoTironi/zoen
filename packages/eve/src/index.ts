/**
 * Eve package entry — conversation-owned surface only.
 * Forbidden: pg adapter, S3 evidence credentials, authority DB credentials, shell/file/web execution.
 * Allowed: kernel, contracts ports, released ontology read/propose clients.
 */
export type { Database, SqlConnection, Authorizer } from '../../contracts/src/ports.js';

export const EVE_DEPENDENCY_BOUNDARY = {
  package: 'packages/eve',
  mayImport: ['packages/kernel', 'packages/contracts', 'packages/clients'] as const,
  mustNotImport: ['pg', 'packages/adapters/src/pg', 'packages/adapters/src/s3'] as const,
} as const;
