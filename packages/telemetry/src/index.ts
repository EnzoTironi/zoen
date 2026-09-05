/**
 * Telemetry package — structured redacted instrumentation (SPEC-008).
 * No credentials, pg adapters, or raw evidence in this boundary.
 */
export const TELEMETRY_PACKAGE_BOUNDARY = {
  package: 'packages/telemetry',
  mayImport: ['packages/kernel', 'packages/contracts'] as const,
  mustNotImport: ['AUTHORITY_CREDENTIAL', 'pg'] as const,
} as const;

export {
  RedactionService,
  REDACTION_IMPL,
  ALLOWLISTED_ATTRIBUTES,
  secretContentScan,
} from './redaction.js';
export type { RawFailureLog, RedactOutcome } from './redaction.js';
export type {
  TelemetryKind,
  RetentionClass,
  ExportScope,
  CorrelationIds,
  RedactedOperationalEvent,
} from './types.js';
export type { TelemetrySink, TelemetryExportPort } from './ports.js';
