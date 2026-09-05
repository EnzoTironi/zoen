/**
 * Single-use invitation acceptance (AcceptInvitation).
 * Consumes invitation + membership + receipt atomically; never replaces World head.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalDigest } from '../../../kernel/src/json.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { fail, ok, type Result } from '../../../kernel/src/result.js';

const REALMS = new Set(['live', 'evaluation'] as const);
type Realm = 'live' | 'evaluation';
type InviteRole = 'editor' | 'viewer';

export type CreateInvitationInput = Readonly<{
  worldId: UUID;
  realm: Realm;
  createdBy: UUID;
  intendedPrincipalId: UUID;
  role: InviteRole;
  expiresAt: Date;
  now?: Date;
}>;

export type InvitationRef = Readonly<{
  tag: 'InvitationRef';
  invitationHash: string;
  worldId: UUID;
  realm: Realm;
  intendedPrincipalId: UUID;
  role: InviteRole;
  expiresAt: string;
  /** Opaque secret returned once; store only the hash server-side. */
  invitationToken: string;
}>;

export type AcceptInvitationInput = Readonly<{
  invitationToken: string;
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  operationId: UUID;
  now?: Date;
}>;

export type MembershipReceipt = Readonly<{
  tag: 'MembershipReceipt';
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  role: InviteRole;
  invitationHash: string;
  operationId: UUID;
  receiptId: UUID;
  commitId: UUID;
  replay: boolean;
}>;

function tokenPair(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = canonicalDigest({ token } as never);
  return { token, hash };
}

async function beginWorld(
  client: PoolClient,
  worldId: string,
  realm: string,
  isolation: 'SERIALIZABLE' | 'READ COMMITTED' = 'SERIALIZABLE',
): Promise<void> {
  await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
  await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
  await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
}

/** Owner/editor plants a single-use invitation for an intended principal. */
export async function createInvitation(
  pool: Pool,
  input: CreateInvitationInput,
): Promise<Result<InvitationRef>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (input.role !== 'editor' && input.role !== 'viewer') return fail('InvalidInput', 'ROLE');
  try {
    uuid(input.worldId);
    uuid(input.createdBy);
    uuid(input.intendedPrincipalId);
  } catch {
    return fail('InvalidInput', 'INVITE_IDS');
  }
  const now = input.now ?? new Date();
  if (input.expiresAt.getTime() <= now.getTime()) return fail('InvalidInput', 'EXPIRES_AT');

  const client = await pool.connect();
  try {
    await beginWorld(client, input.worldId, input.realm, 'READ COMMITTED');
    const world = await client.query<{ emergency_deny: boolean }>(
      `SELECT emergency_deny FROM ontology.worlds WHERE world_id = $1::uuid AND realm = $2`,
      [input.worldId, input.realm],
    );
    if (world.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail('NotFoundOrDenied', 'WORLD');
    }
    if (world.rows[0]!.emergency_deny) {
      await client.query('ROLLBACK');
      return fail('Denied', 'EMERGENCY_DENY');
    }
    const membership = await client.query<{ role: string; state: string }>(
      `SELECT role, state FROM ontology.memberships
       WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
      [input.worldId, input.realm, input.createdBy],
    );
    if (membership.rows.length === 0 || membership.rows[0]!.state !== 'active') {
      await client.query('ROLLBACK');
      return fail('Denied', 'NO_MEMBERSHIP');
    }
    if (membership.rows[0]!.role !== 'owner' && membership.rows[0]!.role !== 'editor') {
      await client.query('ROLLBACK');
      return fail('Denied', 'INVITE_PRIVILEGE');
    }

    const { token, hash } = tokenPair();
    await client.query(
      `INSERT INTO ontology.invitations(
         invitation_hash, world_id, realm, intended_principal_id, role,
         expires_at, created_by
       ) VALUES ($1,$2::uuid,$3,$4::uuid,$5,$6,$7::uuid)`,
      [
        hash,
        input.worldId,
        input.realm,
        input.intendedPrincipalId,
        input.role,
        input.expiresAt.toISOString(),
        input.createdBy,
      ],
    );
    await client.query('COMMIT');
    return ok(
      Object.freeze({
        tag: 'InvitationRef' as const,
        invitationHash: hash,
        worldId: input.worldId,
        realm: input.realm,
        intendedPrincipalId: input.intendedPrincipalId,
        role: input.role,
        expiresAt: input.expiresAt.toISOString(),
        invitationToken: token,
      }),
    );
  } catch {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return fail('Unavailable', 'CREATE_INVITATION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * AcceptInvitation — consume once; add membership; leave head/claims untouched.
 */
export async function acceptInvitation(
  pool: Pool,
  input: AcceptInvitationInput,
): Promise<Result<MembershipReceipt>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (typeof input.invitationToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.invitationToken)) {
    return fail('InvalidInput', 'INVITATION_TOKEN');
  }
  try {
    uuid(input.worldId);
    uuid(input.principalId);
    uuid(input.operationId);
  } catch {
    return fail('InvalidInput', 'ACCEPT_IDS');
  }
  const invitationHash = canonicalDigest({ token: input.invitationToken } as never);
  const now = input.now ?? new Date();

  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await beginWorld(client, input.worldId, input.realm, 'SERIALIZABLE');

        const invite = await client.query<{
          intended_principal_id: string;
          role: InviteRole;
          expires_at: Date;
          consumed_by: string | null;
          consumed_operation_id: string | null;
        }>(
          `SELECT intended_principal_id::text, role, expires_at,
                  consumed_by::text, consumed_operation_id::text
           FROM ontology.invitations WHERE invitation_hash = $1 FOR UPDATE`,
          [invitationHash],
        );
        if (invite.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail('Denied', 'INVITATION_UNKNOWN');
        }
        const inv = invite.rows[0]!;
        if (inv.intended_principal_id !== input.principalId) {
          await client.query('ROLLBACK');
          return fail('Denied', 'INVITATION_NOT_INTENDED');
        }
        if (inv.expires_at.getTime() <= now.getTime()) {
          await client.query('ROLLBACK');
          return fail('Expired', 'INVITATION_EXPIRED');
        }

        if (inv.consumed_by) {
          if (inv.consumed_by !== input.principalId) {
            await client.query('ROLLBACK');
            return fail('Conflict', 'INVITATION_CONSUMED');
          }
          if (inv.consumed_operation_id !== input.operationId) {
            await client.query('ROLLBACK');
            return fail('Conflict', 'INVITATION_CONSUMED');
          }
          // Replay same intent
          const prior = await client.query<{ receipt_id: string; commit_id: string }>(
            `SELECT r.receipt_id::text, r.commit_id::text
             FROM ontology.operations o
             JOIN ontology.receipts r
               ON r.world_id = o.world_id AND r.realm = o.realm AND r.receipt_id = o.result_ref
             WHERE o.world_id = $1::uuid AND o.realm = $2 AND o.principal_id = $3::uuid
               AND o.semantic_op = 'AcceptInvitation' AND o.operation_id = $4::uuid`,
            [input.worldId, input.realm, input.principalId, input.operationId],
          );
          await client.query('COMMIT');
          if (prior.rows.length === 0) return fail('Unavailable', 'RECEIPT_MISSING');
          return ok(
            Object.freeze({
              tag: 'MembershipReceipt' as const,
              worldId: input.worldId,
              realm: input.realm,
              principalId: input.principalId,
              role: inv.role,
              invitationHash,
              operationId: input.operationId,
              receiptId: uuid(prior.rows[0]!.receipt_id),
              commitId: uuid(prior.rows[0]!.commit_id),
              replay: true,
            }),
          );
        }

        const world = await client.query<{
          emergency_deny: boolean;
          release_digest: string;
          generation_id: string;
        }>(
          `SELECT emergency_deny, release_digest, generation_id::text
           FROM ontology.worlds WHERE world_id = $1::uuid AND realm = $2 FOR SHARE`,
          [input.worldId, input.realm],
        );
        if (world.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail('NotFoundOrDenied', 'WORLD');
        }
        if (world.rows[0]!.emergency_deny) {
          await client.query('ROLLBACK');
          return fail('Denied', 'EMERGENCY_DENY');
        }

        const existingMember = await client.query(
          `SELECT 1 FROM ontology.memberships
           WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
          [input.worldId, input.realm, input.principalId],
        );
        if (existingMember.rows.length > 0) {
          await client.query('ROLLBACK');
          return fail('Conflict', 'ALREADY_MEMBER');
        }

        const commitId = randomUUID();
        const receiptId = randomUUID();
        const headDigest = canonicalDigest({
          kind: 'AcceptInvitation',
          worldId: input.worldId,
          principalId: input.principalId,
          operationId: input.operationId,
          invitationHash,
        } as never);
        // Note: headDigest here is commit envelope only — worlds.release_digest untouched.
        const receiptBody = {
          tag: 'MembershipReceipt',
          worldId: input.worldId,
          realm: input.realm,
          principalId: input.principalId,
          role: inv.role,
          invitationHash,
          operationId: input.operationId,
          releaseDigestUnchanged: world.rows[0]!.release_digest,
          generationIdUnchanged: world.rows[0]!.generation_id,
        };
        const payloadDigest = canonicalDigest(receiptBody as never);

        await client.query(
          `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
           VALUES ($1::uuid,$2,$3::uuid,$4,'active')`,
          [input.worldId, input.realm, input.principalId, inv.role],
        );
        await client.query(
          `INSERT INTO ontology.commits(world_id, realm, commit_id, head_digest, touched_domains)
           VALUES ($1::uuid,$2,$3::uuid,$4,$5::jsonb)`,
          [input.worldId, input.realm, commitId, headDigest, JSON.stringify({ membership: '1' })],
        );
        await client.query(
          `INSERT INTO ontology.receipts(
             world_id, realm, receipt_id, commit_id, kind, payload_digest, payload
           ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'AcceptInvitation',$5,$6::jsonb)`,
          [input.worldId, input.realm, receiptId, commitId, payloadDigest, JSON.stringify(receiptBody)],
        );
        await client.query(
          `INSERT INTO ontology.operations(
             world_id, realm, principal_id, semantic_op, operation_id, intent_digest, result_ref, commit_id
           ) VALUES ($1::uuid,$2,$3::uuid,'AcceptInvitation',$4::uuid,$5,$6::uuid,$7::uuid)`,
          [
            input.worldId,
            input.realm,
            input.principalId,
            input.operationId,
            payloadDigest,
            receiptId,
            commitId,
          ],
        );
        await client.query(
          `UPDATE ontology.invitations
           SET consumed_by = $2::uuid,
               consumed_operation_id = $3::uuid,
               consumed_at = clock_timestamp()
           WHERE invitation_hash = $1 AND consumed_by IS NULL`,
          [invitationHash, input.principalId, input.operationId],
        );

        await client.query('COMMIT');
        return ok(
          Object.freeze({
            tag: 'MembershipReceipt' as const,
            worldId: input.worldId,
            realm: input.realm,
            principalId: input.principalId,
            role: inv.role,
            invitationHash,
            operationId: input.operationId,
            receiptId: uuid(receiptId),
            commitId: uuid(commitId),
            replay: false,
          }),
        );
      } catch (error: unknown) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        const code =
          typeof error === 'object' && error && 'code' in error
            ? String((error as { code: string }).code)
            : '';
        if (code === '23505' || code === '40001' || code === '40P01') {
          if (attempt < 2) continue;
          return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
        }
        throw error;
      }
    }
    return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  } catch {
    return fail('Unavailable', 'ACCEPT_INVITATION_FAILED');
  } finally {
    client.release();
  }
}

/** Test helper: plant a claim without changing release/generation. */
export async function plantClaim(
  pool: Pool,
  input: {
    worldId: UUID;
    realm: Realm;
    principalId: UUID;
    predicateId: string;
    label: string;
  },
): Promise<{ claimId: string; sourceId: string; subjectId: string }> {
  const client = await pool.connect();
  try {
    await beginWorld(client, input.worldId, input.realm, 'READ COMMITTED');
    const sourceId = randomUUID();
    const subjectId = randomUUID();
    const claimId = randomUUID();
    const evidenceId = randomUUID();
    await client.query(
      `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
       VALUES ($1::uuid,$2,'claims',0)
       ON CONFLICT DO NOTHING`,
      [input.worldId, input.realm],
    );
    await client.query(
      `INSERT INTO ontology.sources(world_id, realm, source_id, family_id, name, visibility, created_by)
       VALUES ($1::uuid,$2,$3::uuid,$3::uuid,'seed','owner-only',$4::uuid)`,
      [input.worldId, input.realm, sourceId, input.principalId],
    );
    await client.query(
      `INSERT INTO ontology.subjects(world_id, realm, subject_id, type_id, label)
       VALUES ($1::uuid,$2,$3::uuid,'note',$4)`,
      [input.worldId, input.realm, subjectId, input.label],
    );
    await client.query(
      `INSERT INTO ontology.evidence(
         world_id, realm, evidence_id, source_id, object_key, content_digest, size_bytes, media_type, object_version
       ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'seed/obj',$5,1,'text/plain','1')`,
      [
        input.worldId,
        input.realm,
        evidenceId,
        sourceId,
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
    );
    const payload = {
      id: claimId,
      subjectId,
      predicateId: input.predicateId,
      sourceId,
      knowledgeVersion: '1',
      world: { worldId: input.worldId, realm: input.realm },
      label: input.label,
    };
    await client.query(
      `INSERT INTO ontology.claims(
         world_id, realm, claim_id, subject_id, predicate_id, source_id, payload, domain_id, knowledge_version, asserted_by
       ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6::uuid,$7::jsonb,'claims',1,$8::uuid)`,
      [
        input.worldId,
        input.realm,
        claimId,
        subjectId,
        input.predicateId,
        sourceId,
        JSON.stringify(payload),
        input.principalId,
      ],
    );
    await client.query('COMMIT');
    return { claimId, sourceId, subjectId };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function readWorldHead(
  pool: Pool,
  worldId: UUID,
  realm: Realm,
): Promise<{ releaseDigest: string; generationId: string; claimCount: number }> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
    await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
    const w = await client.query<{ release_digest: string; generation_id: string }>(
      `SELECT release_digest, generation_id::text FROM ontology.worlds
       WHERE world_id = $1::uuid AND realm = $2`,
      [worldId, realm],
    );
    const c = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ontology.claims WHERE world_id = $1::uuid AND realm = $2`,
      [worldId, realm],
    );
    return {
      releaseDigest: w.rows[0]!.release_digest,
      generationId: w.rows[0]!.generation_id,
      claimCount: c.rows[0]!.n,
    };
  } finally {
    client.release();
  }
}
