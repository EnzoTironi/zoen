/**
 * Operation idempotency with fresh replay disclosure (ZN-0021).
 * Same key+intent → one result after current-rights check; changed intent → Conflict.
 */
import type { SqlConnection } from '../../../contracts/src/ports.js';
import type { WorldRef, UUID } from '../../../kernel/src/ids.js';
import { uuid } from '../../../kernel/src/ids.js';
import { parseJsonText, type JsonValue } from '../../../kernel/src/json.js';
import { KernelError } from '../../../kernel/src/result.js';
import { operationScope } from './guards.js';

export type OperationKey = Readonly<{
  world: WorldRef;
  principalId: UUID;
  semanticOp: string;
  operationId: UUID;
}>;

export type StoredOperation = Readonly<{
  intentDigest: string;
  resultRef: UUID;
  commitId: UUID;
  payload: JsonValue;
  securityRevision: string;
}>;

export type IdempotencyDecision =
  | Readonly<{ tag: 'absent' }>
  | Readonly<{ tag: 'replay'; stored: StoredOperation }>
  | Readonly<{ tag: 'conflict' }>;

/** Advisory lock then lookup — winner of a unique-key race is re-read. */
export async function lockAndLookupOperation(
  sql: SqlConnection,
  key: OperationKey,
  intentDigest: string,
): Promise<IdempotencyDecision> {
  await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    operationScope(
      key.world.worldId,
      key.world.realm,
      key.principalId,
      key.semanticOp,
      key.operationId,
    ),
  ]);
  const previous = await sql.query<{
    intent_digest: string;
    result_ref: string;
    commit_id: string;
    payload: string;
    security_revision: string;
  }>(
    `SELECT o.intent_digest, o.result_ref, o.commit_id, r.payload::text,
            COALESCE(o.security_revision, 0)::text AS security_revision
     FROM ontology.operations o
     JOIN ontology.receipts r
       ON r.world_id=o.world_id AND r.realm=o.realm AND r.receipt_id=o.result_ref
     WHERE o.world_id=$1 AND o.realm=$2 AND o.principal_id=$3
       AND o.semantic_op=$4 AND o.operation_id=$5`,
    [
      key.world.worldId,
      key.world.realm,
      key.principalId,
      key.semanticOp,
      key.operationId,
    ],
  );
  const prior = previous[0];
  if (!prior) return Object.freeze({ tag: 'absent' as const });
  if (prior.intent_digest !== intentDigest) return Object.freeze({ tag: 'conflict' as const });
  return Object.freeze({
    tag: 'replay' as const,
    stored: Object.freeze({
      intentDigest: prior.intent_digest,
      resultRef: uuid(prior.result_ref),
      commitId: uuid(prior.commit_id),
      payload: parseJsonText(prior.payload),
      securityRevision: prior.security_revision,
    }),
  });
}

/**
 * Fresh disclosure gate for a stored replay.
 * Revocation / security revision advance / inactive membership → Denied (no payload).
 */
export async function assertReplayDisclosure(
  sql: SqlConnection,
  world: WorldRef,
  principalId: UUID,
  storedSecurityRevision: string,
): Promise<void> {
  const worlds = await sql.query<{
    security_revision: string;
    emergency_deny: boolean;
  }>(
    `SELECT security_revision::text, emergency_deny
     FROM ontology.worlds WHERE world_id=$1 AND realm=$2`,
    [world.worldId, world.realm],
  );
  const worldRow = worlds[0];
  if (!worldRow || worldRow.emergency_deny) {
    throw new KernelError('Denied', 'DISCLOSURE_CHANGED');
  }
  if (worldRow.security_revision !== storedSecurityRevision) {
    throw new KernelError('Denied', 'DISCLOSURE_CHANGED');
  }
  const members = await sql.query<{ state: string }>(
    `SELECT state FROM ontology.memberships
     WHERE world_id=$1 AND realm=$2 AND principal_id=$3`,
    [world.worldId, world.realm, principalId],
  );
  const member = members[0];
  if (!member || member.state !== 'active') {
    throw new KernelError('Denied', 'DISCLOSURE_CHANGED');
  }
}

export function redactStoredOutput(): never {
  throw new KernelError('Denied', 'DISCLOSURE_CHANGED');
}
