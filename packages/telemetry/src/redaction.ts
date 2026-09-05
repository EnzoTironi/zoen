/// <reference types="node" />
import { createHash, randomUUID } from 'node:crypto';
import type { TelemetrySink } from './ports.js';
import type {
  CorrelationIds,
  ExportScope,
  RedactedOperationalEvent,
  RetentionClass,
  TelemetryKind,
} from './types.js';

export const REDACTION_IMPL = 'telemetry-redaction-v1';

/** Allowlisted attribute keys for operational logs. */
export const ALLOWLISTED_ATTRIBUTES = Object.freeze([
  'errorCode',
  'httpStatus',
  'transport',
  'operation',
  'durationMs',
  'quotaClass',
  'resultTag',
] as const);

const FORBIDDEN_KEY_RE =
  /(password|secret|token|credential|api[_-]?key|authorization|cookie|prompt|evidence|content|clinical|note|rawSql|bearer)/i;

const SECRET_VALUE_RE =
  /(password\s*=|secret\s*=|Bearer\s+[A-Za-z0-9._\-]+|AKIA[0-9A-Z]{16}|-----BEGIN)/i;

export type RawFailureLog = Readonly<{
  kind?: TelemetryKind;
  operation: string;
  result: string;
  occurredAt?: string;
  /** OpenTelemetry-style correlation (trace/span). */
  traceId?: string;
  spanId?: string;
  requestId?: string;
  caseId?: string;
  worldId?: string;
  commitId?: string;
  /** Untrusted bag — may contain credentials, clinical notes, etc. */
  attributes?: Readonly<Record<string, unknown>>;
  /** Free-form message that may include secrets — scanned and omitted. */
  message?: string;
}>;

export type RedactOutcome =
  | Readonly<{ tag: 'Ok'; value: RedactedOperationalEvent }>
  | Readonly<{ tag: 'Denied'; reason: 'INVALID_INPUT' | 'FORBIDDEN_PAYLOAD' | 'UNSUPPORTED_SCOPE' }>;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function hashId(value: string | undefined | null, purpose: string): string | null {
  if (!value || typeof value !== 'string' || value.length === 0) return null;
  return sha256Hex(`${REDACTION_IMPL}|${purpose}|${value}`);
}

function isAllowlistedKey(key: string): boolean {
  return (ALLOWLISTED_ATTRIBUTES as readonly string[]).includes(key);
}

/**
 * Structured telemetry redaction (SPEC-008 / ZN-0047).
 * Allowlisted schema + OTel correlation; hash/omit identifiers;
 * prohibit credentials, raw evidence and prompts by default;
 * separate security-audit export from operator-metrics access.
 */
export class RedactionService {
  constructor(private readonly sink: TelemetrySink | null = null) {}

  redact(raw: RawFailureLog): RedactOutcome {
    if (!raw.operation || raw.operation.length > 80) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (!raw.result || raw.result.length > 80) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    // Free-form messages that contain secrets are omitted (event still recorded).
    const safeMessage =
      raw.message !== undefined && !SECRET_VALUE_RE.test(raw.message) && raw.message.length <= 256
        ? raw.message
        : undefined;
    void safeMessage;
    const kind: TelemetryKind = raw.kind ?? 'request.failed';
    const retention: RetentionClass =
      kind === 'security.audit' ? 'security-audit' : kind === 'operator.metric' ? 'ephemeral' : 'operational';

    const correlation: CorrelationIds = Object.freeze({
      traceId: raw.traceId && /^[a-f0-9]{16,64}$/i.test(raw.traceId) ? raw.traceId.toLowerCase() : sha256Hex(randomUUID()).slice(0, 32),
      spanId: raw.spanId && /^[a-f0-9]{8,32}$/i.test(raw.spanId) ? raw.spanId.toLowerCase() : sha256Hex(randomUUID()).slice(0, 16),
      requestId: raw.requestId && raw.requestId.length <= 128 ? raw.requestId : sha256Hex(randomUUID()).slice(0, 32),
      caseIdHash: hashId(raw.caseId, 'case'),
      worldIdHash: hashId(raw.worldId, 'world'),
      commitIdHash: hashId(raw.commitId, 'commit'),
    });

    const attributes: Record<string, string | number | boolean | null> = Object.create(null);
    for (const [key, value] of Object.entries(raw.attributes ?? {})) {
      if (FORBIDDEN_KEY_RE.test(key)) continue;
      if (!isAllowlistedKey(key)) continue;
      if (value === null) {
        attributes[key] = null;
        continue;
      }
      if (typeof value === 'string') {
        if (SECRET_VALUE_RE.test(value) || value.length > 256) continue;
        attributes[key] = value;
        continue;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        attributes[key] = value;
      }
    }

    const event: RedactedOperationalEvent = Object.freeze({
      eventId: randomUUID(),
      kind,
      retentionClass: retention,
      correlation,
      operation: raw.operation,
      result: raw.result,
      attributes: Object.freeze(attributes),
      occurredAt: raw.occurredAt ?? new Date().toISOString(),
    });

    // Defense: scan serialized form for leaked secrets / clinical content
    const blob = JSON.stringify(event).toLowerCase();
    if (SECRET_VALUE_RE.test(blob) || blob.includes('clinical note') || blob.includes('password=')) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'FORBIDDEN_PAYLOAD' as const });
    }

    return Object.freeze({ tag: 'Ok' as const, value: event });
  }

  async recordFailure(raw: RawFailureLog): Promise<RedactOutcome> {
    const outcome = this.redact(raw);
    if (outcome.tag === 'Ok' && this.sink) {
      await this.sink.append(outcome.value);
    }
    return outcome;
  }

  /**
   * Export filtered by permission scope.
   * security-audit: security.audit + request.failed with security retention
   * operator-metrics: operator.metric + completed/failed operational (no security-audit retention)
   */
  exportForScope(
    scope: ExportScope,
    events: readonly RedactedOperationalEvent[],
  ): RedactOutcome | Readonly<{ tag: 'Ok'; value: readonly RedactedOperationalEvent[] }> {
    if (scope !== 'security-audit' && scope !== 'operator-metrics') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'UNSUPPORTED_SCOPE' as const });
    }
    const filtered = events.filter((e) => {
      if (scope === 'security-audit') {
        return e.retentionClass === 'security-audit' || e.kind === 'security.audit';
      }
      // operator metrics must not receive security-audit retention payloads
      return e.retentionClass !== 'security-audit' && e.kind !== 'security.audit';
    });
    return Object.freeze({ tag: 'Ok' as const, value: Object.freeze([...filtered]) });
  }
}

/** Secret/content scan over serialized logs — empty means clean. */
export function secretContentScan(logs: readonly unknown[], clinicalNeedle: string, credentialNeedle: string): readonly string[] {
  const hits: string[] = [];
  for (const [i, log] of logs.entries()) {
    const blob = JSON.stringify(log);
    if (blob.includes(credentialNeedle)) hits.push(`credential@${i}`);
    if (blob.toLowerCase().includes(clinicalNeedle.toLowerCase())) hits.push(`clinical@${i}`);
    if (SECRET_VALUE_RE.test(blob)) hits.push(`secretPattern@${i}`);
    if (/https?:\/\//i.test(blob) && /presign|s3\.amazonaws/i.test(blob)) hits.push(`url@${i}`);
  }
  return Object.freeze(hits);
}
