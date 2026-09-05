/**
 * Idempotent private World genesis (CreatePersonalWorld).
 * Uses ontology.bootstrap_operations uniqueness — no World key before commit.
 * Presence is required; presence alone still does not grant without this operation.
 */
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalDigest } from '../../../kernel/src/json.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { fail, ok, type Result } from '../../../kernel/src/result.js';

const DIGEST_RE = /^[a-f0-9]{64}$/;
const SEMANTIC_OP = 'CreatePersonalWorld';
const REALM = 'live' as const;

export type GenesisInput = Readonly<{
  principalId: UUID;
  operationId: UUID;
  /** Image-pinned foundation seed digest — never arbitrary client bootstrap policy. */
  seedDigest: string;
  worldName?: string;
}>;

export type GenesisReceipt = Readonly<{
  tag: 'GenesisReceipt';
  worldId: UUID;
  realm: typeof REALM;
  receiptId: UUID;
  commitId: UUID;
  operationId: UUID;
  intentDigest: string;
  seedDigest: string;
  replay: boolean;
}>;

function intentDigestOf(input: GenesisInput): string {
  return canonicalDigest({
    semanticOp: SEMANTIC_OP,
    principalId: input.principalId,
    operationId: input.operationId,
    seedDigest: input.seedDigest,
    realm: REALM,
  } as never);
}

async function loadExisting(
  client: PoolClient,
  principalId: UUID,
  operationId: UUID,
): Promise<{ intent_digest: string; world_id: string; result_ref: string; seed?: string } | null> {
  const rows = await client.query<{
    intent_digest: string;
    world_id: string;
    result_ref: string;
  }>(
    `SELECT intent_digest, world_id::text AS world_id, result_ref::text AS result_ref
     FROM ontology.bootstrap_operations
     WHERE principal_id = $1::uuid AND semantic_op = $2 AND operation_id = $3::uuid`,
    [principalId, SEMANTIC_OP, operationId],
  );
  return rows.rows[0] ?? null;
}

async function receiptPayload(
  client: PoolClient,
  worldId: string,
  receiptId: string,
): Promise<{ commitId: string; seedDigest: string }> {
  const rows = await client.query<{ commit_id: string; payload: { seedDigest?: string } }>(
    `SELECT commit_id::text AS commit_id, payload
     FROM ontology.receipts
     WHERE world_id = $1::uuid AND realm = $2 AND receipt_id = $3::uuid`,
    [worldId, REALM, receiptId],
  );
  const row = rows.rows[0];
  if (!row) throw new Error('GENESIS_RECEIPT_MISSING');
  return {
    commitId: row.commit_id,
    seedDigest: typeof row.payload?.seedDigest === 'string' ? row.payload.seedDigest : '',
  };
}

/**
 * CreatePersonalWorld — atomic head, owner membership, receipt, outbox.
 * Same (principal, operationId, intent) → one World; changed intent → Conflict.
 */
export async function createPersonalWorld(
  pool: Pool,
  input: GenesisInput,
): Promise<Result<GenesisReceipt>> {
  if (!DIGEST_RE.test(input.seedDigest)) return fail('InvalidInput', 'SEED_DIGEST');
  try {
    uuid(input.principalId);
    uuid(input.operationId);
  } catch {
    return fail('InvalidInput', 'GENESIS_IDS');
  }

  const intentDigest = intentDigestOf(input);
  const worldName = input.worldName ?? 'Personal World';
  if (worldName.length < 1 || worldName.length > 120) return fail('InvalidInput', 'WORLD_NAME');

  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await client.query("SELECT set_config('zoen.principal_id', $1, true)", [input.principalId]);

        const existing = await loadExisting(client, input.principalId, input.operationId);
        if (existing) {
          if (existing.intent_digest !== intentDigest) {
            await client.query('ROLLBACK');
            return fail('Conflict', 'OPERATION_ID_REUSED');
          }
          await client.query("SELECT set_config('zoen.world_id', $1, true)", [existing.world_id]);
          await client.query("SELECT set_config('zoen.realm', $1, true)", [REALM]);
          const payload = await receiptPayload(client, existing.world_id, existing.result_ref);
          await client.query('COMMIT');
          return ok(
            Object.freeze({
              tag: 'GenesisReceipt' as const,
              worldId: uuid(existing.world_id),
              realm: REALM,
              receiptId: uuid(existing.result_ref),
              commitId: uuid(payload.commitId),
              operationId: input.operationId,
              intentDigest,
              seedDigest: payload.seedDigest || input.seedDigest,
              replay: true,
            }),
          );
        }

        const worldId = randomUUID();
        const generationId = randomUUID();
        const commitId = randomUUID();
        const receiptId = randomUUID();
        const outboxId = randomUUID();
        const releaseDigest = input.seedDigest; // image-pinned foundation

        await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
        await client.query("SELECT set_config('zoen.realm', $1, true)", [REALM]);

        await client.query(
          `INSERT INTO ontology.worlds(
             world_id, realm, owner_id, name, release_digest, generation_id,
             cell_epoch, security_revision, emergency_deny
           ) VALUES ($1::uuid,$2,$3::uuid,$4,$5,$6::uuid,1,0,false)`,
          [worldId, REALM, input.principalId, worldName, releaseDigest, generationId],
        );
        await client.query(
          `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
           VALUES ($1::uuid,$2,$3::uuid,'owner','active')`,
          [worldId, REALM, input.principalId],
        );
        await client.query(
          `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
           VALUES ($1::uuid,$2,'world',0)`,
          [worldId, REALM],
        );

        const headDigest = canonicalDigest({
          releaseDigest,
          generationId,
          cellEpoch: '1',
          securityRevision: '0',
        } as never);
        const receiptBody = {
          tag: 'GenesisReceipt',
          worldId,
          realm: REALM,
          seedDigest: input.seedDigest,
          operationId: input.operationId,
          ownerId: input.principalId,
        };
        const payloadDigest = canonicalDigest(receiptBody as never);

        await client.query(
          `INSERT INTO ontology.commits(world_id, realm, commit_id, head_digest, touched_domains)
           VALUES ($1::uuid,$2,$3::uuid,$4,$5::jsonb)`,
          [worldId, REALM, commitId, headDigest, JSON.stringify({ world: '1' })],
        );
        await client.query(
          `INSERT INTO ontology.receipts(
             world_id, realm, receipt_id, commit_id, kind, payload_digest, payload
           ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7::jsonb)`,
          [worldId, REALM, receiptId, commitId, SEMANTIC_OP, payloadDigest, JSON.stringify(receiptBody)],
        );
        await client.query(
          `INSERT INTO jobs.outbox(
             world_id, realm, outbox_id, owner, commit_id, event_ordinal, payload_ref
           ) VALUES ($1::uuid,$2,$3::uuid,'authority',$4::uuid,0,$5::uuid)`,
          [worldId, REALM, outboxId, commitId, receiptId],
        );
        await client.query(
          `INSERT INTO ontology.bootstrap_operations(
             principal_id, semantic_op, operation_id, intent_digest, world_id, realm, result_ref
           ) VALUES ($1::uuid,$2,$3::uuid,$4,$5::uuid,$6,$7::uuid)`,
          [input.principalId, SEMANTIC_OP, input.operationId, intentDigest, worldId, REALM, receiptId],
        );

        await client.query('COMMIT');
        return ok(
          Object.freeze({
            tag: 'GenesisReceipt' as const,
            worldId: uuid(worldId),
            realm: REALM,
            receiptId: uuid(receiptId),
            commitId: uuid(commitId),
            operationId: input.operationId,
            intentDigest,
            seedDigest: input.seedDigest,
            replay: false,
          }),
        );
      } catch (error: unknown) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : '';
        // unique_violation or serialization_failure → retry / re-read
        if (code === '23505' || code === '40001' || code === '40P01') {
          if (attempt < 2) continue;
          // Final attempt: re-read as replay if winner committed
          await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
          await client.query("SELECT set_config('zoen.principal_id', $1, true)", [input.principalId]);
          const existing = await loadExisting(client, input.principalId, input.operationId);
          if (existing && existing.intent_digest === intentDigest) {
            await client.query("SELECT set_config('zoen.world_id', $1, true)", [existing.world_id]);
            await client.query("SELECT set_config('zoen.realm', $1, true)", [REALM]);
            const payload = await receiptPayload(client, existing.world_id, existing.result_ref);
            await client.query('COMMIT');
            return ok(
              Object.freeze({
                tag: 'GenesisReceipt' as const,
                worldId: uuid(existing.world_id),
                realm: REALM,
                receiptId: uuid(existing.result_ref),
                commitId: uuid(payload.commitId),
                operationId: input.operationId,
                intentDigest,
                seedDigest: payload.seedDigest || input.seedDigest,
                replay: true,
              }),
            );
          }
          await client.query('ROLLBACK');
          if (existing && existing.intent_digest !== intentDigest) {
            return fail('Conflict', 'OPERATION_ID_REUSED');
          }
          return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
        }
        throw error;
      }
    }
    return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'GENESIS_FAILED';
    void msg;
    return fail('Unavailable', 'GENESIS_FAILED');
  } finally {
    client.release();
  }
}
