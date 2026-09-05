/** Ontology authority package entry (SPEC-003). */
export {
  MIGRATION_PHASES,
  AUTHORITY_TABLES,
  SCHEMA_ROLES,
  applyMigrationPlan,
  recordMigrationPhase,
  assertAuthorityTables,
  probeSchemaDiscipline,
  type MigrationPhase,
  type SchemaDisciplineReport,
} from './schema.js';
export { Authority, type WorldTransaction, type MutationOutput } from './transaction.js';
export {
  sortedDomains,
  assertFresh,
  assertGuardsFresh,
  absenceGuard,
  domainGuard,
  guardDomains,
  operationScope,
  isRetryableSql,
  assertLoadedRelease,
  guardProjection,
  type ReadGuard,
  type GuardContext,
} from './guards.js';
export { typedPlan, type TypedAuthorityPlan } from './plan.js';

export {
  lockAndLookupOperation,
  assertReplayDisclosure,
  redactStoredOutput,
  type OperationKey,
  type StoredOperation,
  type IdempotencyDecision,
} from './idempotency.js';

export {
  OutboxQueue,
  eventIdentity,
  eventKey,
  type OutboxLease,
  type OutboxEventIdentity,
  type ConsumerAdmitResult,
  type ProgressRecord,
} from './outbox.js';

