/**
 * Telemetry package entry — structured redacted instrumentation boundary.
 * Implementation modules remain ticket-owned; this entry exposes no secrets.
 */
export const TELEMETRY_PACKAGE_BOUNDARY = {
  package: 'packages/telemetry',
  mayImport: ['packages/kernel', 'packages/contracts'] as const,
  mustNotImport: ['AUTHORITY_CREDENTIAL', 'pg'] as const,
} as const;
