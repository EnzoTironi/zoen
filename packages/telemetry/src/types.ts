/** Telemetry event kinds (allowlisted). */
export type TelemetryKind =
  | 'request.failed'
  | 'request.completed'
  | 'security.audit'
  | 'operator.metric';

export type RetentionClass = 'operational' | 'security-audit' | 'ephemeral';

export type ExportScope = 'security-audit' | 'operator-metrics';

export type CorrelationIds = Readonly<{
  traceId: string;
  spanId: string;
  requestId: string;
  caseIdHash: string | null;
  worldIdHash: string | null;
  commitIdHash: string | null;
}>;

export type RedactedOperationalEvent = Readonly<{
  eventId: string;
  kind: TelemetryKind;
  retentionClass: RetentionClass;
  correlation: CorrelationIds;
  operation: string;
  result: string;
  /** Allowlisted attributes only — never credentials/prompts/raw evidence. */
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  occurredAt: string;
}>;
