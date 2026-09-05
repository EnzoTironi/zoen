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

/** Capability admission state — unadmitted providers are explicit disabled, never fake-healthy. */
export type CapabilityState =
  | 'admitted'
  | 'disabled'
  | 'incompatible'
  | 'draining'
  | 'unavailable';

export type CapabilityReport = Readonly<{
  id: string;
  state: CapabilityState;
  reason: string | null;
}>;

export type Liveness = Readonly<{
  alive: true;
  checkedAt: string;
}>;

export type AdmittedDependencies = Readonly<{
  ready: boolean;
  coreUsable: boolean;
  effectsUnavailable: boolean;
  migrationsCompatible: boolean;
  locksCompatible: boolean;
  rolesCompatible: boolean;
  capabilities: readonly CapabilityReport[];
  draining: boolean;
  inFlight: number;
  checkedAt: string;
  impl: string;
}>;

export type ReadinessProbe = Readonly<{
  requiredMigrations?: readonly string[];
  migrationsPresent?: readonly string[];
  locksCompatible?: boolean;
  rolesCompatible?: boolean;
  admittedCapabilities?: readonly string[];
  unadmittedCapabilities?: readonly string[];
  /** Free-form notes — scanned for secrets; must not carry credentials. */
  notes?: string;
}>;

export type ReadinessOutcome =
  | Readonly<{ tag: 'Ok'; value: unknown }>
  | Readonly<{ tag: 'Denied'; reason: 'INVALID_INPUT' | 'FORBIDDEN_PAYLOAD' | 'DRAINING' }>
  | Readonly<{ tag: 'Blocked'; reason: 'MISSING_LEDGER_OR_DEPENDENCY' | 'MISSING_FENCE_STORE' | 'IN_FLIGHT_REMAINING' }>
  | Readonly<{ tag: 'Unsupported'; reason: 'PROFILE_LIMIT'; observed: number; limit: number }>;

export type RecoveryFence = Readonly<{
  cellId: string;
  epoch: number;
  dispatchEnabled: boolean;
  deletionLedgerCut: string | null;
}>;

export type DrainResult = Readonly<{
  tag: 'Ok' | 'Denied' | 'Blocked';
  reason?: string;
  draining: boolean;
  inFlight: number;
  releasedJobIds: readonly string[];
  epoch?: number;
  dispatchEnabled?: boolean;
  duplicateSuppressed?: boolean;
}>;

export type LegacySubject = Readonly<{
  legacyId: string;
  email: string;
  role: string;
}>;

export type LegacyImportManifest = Readonly<{
  manifestId: string;
  version: string;
  legacySourceCommit: string;
  realm: 'evaluation';
  rowCounts: Readonly<{ subjects: number; admitted: number; unmatched: number; rolesDenied: number }>;
  rightsMapping: readonly Readonly<{ legacyId: string; mappedRole: string | null; admitted: boolean; reason: string }>[];
  unmatchedRecords: readonly string[];
  semanticDiffs: readonly string[];
  cutoverApproved: false;
  administratorAutoGranted: false;
}>;

export type LegacyImportOutcome =
  | Readonly<{ tag: 'Ok'; value: LegacyImportManifest }>
  | Readonly<{ tag: 'Denied'; reason: 'INVALID_INPUT' | 'FORBIDDEN_PAYLOAD' | 'LIVE_REALM_FORBIDDEN' }>
  | Readonly<{ tag: 'Blocked'; reason: 'MISSING_STORE' | 'PRODUCTION_MUTATION_FORBIDDEN' }>
  | Readonly<{ tag: 'Unsupported'; reason: 'PROFILE_LIMIT'; observed: number; limit: number }>;

