/**
 * Session termination / emergency deny and final disclosure recheck (ZN-0017).
 * Advances security_revision; does not pretend delivered data can be recalled.
 */
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { fail, ok, type Result } from '../../../kernel/src/result.js';

const REALMS = new Set(['live', 'evaluation'] as const);
type Realm = 'live' | 'evaluation';

export type FrameDraft = Readonly<{
  frameId: UUID;
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  purpose: string;
  securityRevisionAtCompose: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type DisclosureSent = Readonly<{
  tag: 'DisclosureSent';
  frameId: UUID;
  payload: Readonly<Record<string, unknown>>;
}>;

export type DisclosureSuppressed = Readonly<{
  tag: 'DisclosureSuppressed';
  frameId: UUID;
  code: string;
  auditId: UUID;
}>;

async function beginWorld(client: PoolClient, worldId: string, realm: string): Promise<void> {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
  await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
}

async function writeAudit(
  client: PoolClient,
  input: {
    worldId: string;
    realm: string;
    kind: string;
    principalId?: string | null;
    actorId?: string | null;
    securityRevision: string;
    detail: Record<string, unknown>;
  },
): Promise<string> {
  const auditId = randomUUID();
  await client.query(
    `INSERT INTO ontology.authority_audit(
       audit_id, world_id, realm, kind, principal_id, actor_id, security_revision, detail
     ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::bigint,$8::jsonb)`,
    [
      auditId,
      input.worldId,
      input.realm,
      input.kind,
      input.principalId ?? null,
      input.actorId ?? null,
      input.securityRevision,
      JSON.stringify(input.detail),
    ],
  );
  return auditId;
}

/** Revoke a principal's membership and bump security revision. */
export async function revokePrincipal(
  pool: Pool,
  input: {
    worldId: UUID;
    realm: Realm;
    actorId: UUID;
    principalId: UUID;
  },
): Promise<Result<{ securityRevision: string; auditId: UUID }>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  try {
    uuid(input.worldId);
    uuid(input.actorId);
    uuid(input.principalId);
  } catch {
    return fail('InvalidInput', 'REVOKE_IDS');
  }
  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await beginWorld(client, input.worldId, input.realm);
        const actor = await client.query<{ role: string; state: string }>(
          `SELECT role, state FROM ontology.memberships
           WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
          [input.worldId, input.realm, input.actorId],
        );
        if (actor.rows.length === 0 || actor.rows[0]!.state !== 'active' || actor.rows[0]!.role !== 'owner') {
          await client.query('ROLLBACK');
          return fail('Denied', 'REVOKE_PRIVILEGE');
        }
        const target = await client.query(
          `UPDATE ontology.memberships SET state = 'revoked'
           WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid AND state = 'active'
           RETURNING principal_id`,
          [input.worldId, input.realm, input.principalId],
        );
        if (target.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail('NotFoundOrDenied', 'MEMBERSHIP');
        }
        const bumped = await client.query<{ security_revision: string }>(
          `UPDATE ontology.worlds
           SET security_revision = security_revision + 1
           WHERE world_id = $1::uuid AND realm = $2
           RETURNING security_revision::text`,
          [input.worldId, input.realm],
        );
        const rev = bumped.rows[0]!.security_revision;
        const auditId = await writeAudit(client, {
          worldId: input.worldId,
          realm: input.realm,
          kind: 'MembershipRevoked',
          principalId: input.principalId,
          actorId: input.actorId,
          securityRevision: rev,
          detail: { principalId: input.principalId },
        });
        await client.query('COMMIT');
        return ok(Object.freeze({ securityRevision: rev, auditId: uuid(auditId) }));
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
        if (code === '40001' || code === '40P01') {
          if (attempt < 2) continue;
          return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
        }
        throw error;
      }
    }
    return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  } catch {
    return fail('Unavailable', 'REVOKE_FAILED');
  } finally {
    client.release();
  }
}

/** World-wide emergency deny — blocks fresh disclosure/dispatch. */
export async function setEmergencyDeny(
  pool: Pool,
  input: { worldId: UUID; realm: Realm; actorId: UUID },
): Promise<Result<{ securityRevision: string; auditId: UUID }>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  try {
    uuid(input.worldId);
    uuid(input.actorId);
  } catch {
    return fail('InvalidInput', 'DENY_IDS');
  }
  const client = await pool.connect();
  try {
    await beginWorld(client, input.worldId, input.realm);
    const actor = await client.query<{ role: string; state: string }>(
      `SELECT role, state FROM ontology.memberships
       WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
      [input.worldId, input.realm, input.actorId],
    );
    if (actor.rows.length === 0 || actor.rows[0]!.state !== 'active' || actor.rows[0]!.role !== 'owner') {
      await client.query('ROLLBACK');
      return fail('Denied', 'EMERGENCY_PRIVILEGE');
    }
    const bumped = await client.query<{ security_revision: string }>(
      `UPDATE ontology.worlds
       SET emergency_deny = true, security_revision = security_revision + 1
       WHERE world_id = $1::uuid AND realm = $2
       RETURNING security_revision::text`,
      [input.worldId, input.realm],
    );
    const rev = bumped.rows[0]!.security_revision;
    const auditId = await writeAudit(client, {
      worldId: input.worldId,
      realm: input.realm,
      kind: 'EmergencyDeny',
      actorId: input.actorId,
      securityRevision: rev,
      detail: { emergencyDeny: true },
    });
    await client.query('COMMIT');
    return ok(Object.freeze({ securityRevision: rev, auditId: uuid(auditId) }));
  } catch {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return fail('Unavailable', 'EMERGENCY_DENY_FAILED');
  } finally {
    client.release();
  }
}

/** Compose a Frame draft (not yet disclosed). */
export async function composeFrame(
  pool: Pool,
  input: {
    worldId: UUID;
    realm: Realm;
    principalId: UUID;
    purpose: string;
    payload: Readonly<Record<string, unknown>>;
  },
): Promise<Result<FrameDraft>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (typeof input.purpose !== 'string' || input.purpose.length < 1) return fail('InvalidInput', 'PURPOSE');
  try {
    uuid(input.worldId);
    uuid(input.principalId);
  } catch {
    return fail('InvalidInput', 'FRAME_IDS');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query("SELECT set_config('zoen.world_id', $1, true)", [input.worldId]);
    await client.query("SELECT set_config('zoen.realm', $1, true)", [input.realm]);
    const world = await client.query<{ security_revision: string; emergency_deny: boolean }>(
      `SELECT security_revision::text, emergency_deny FROM ontology.worlds
       WHERE world_id = $1::uuid AND realm = $2`,
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
    const membership = await client.query<{ state: string }>(
      `SELECT state FROM ontology.memberships
       WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
      [input.worldId, input.realm, input.principalId],
    );
    if (membership.rows.length === 0 || membership.rows[0]!.state !== 'active') {
      await client.query('ROLLBACK');
      return fail('Denied', 'MEMBERSHIP_REVOKED');
    }
    const frameId = randomUUID();
    const expires = new Date(Date.now() + 300_000).toISOString();
    await client.query(
      `INSERT INTO ontology.frames(
         world_id, realm, frame_id, principal_id, purpose, head_digest, basis, payload, source_ids, expires_at
       ) VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7::jsonb,$8::jsonb,$9::uuid[],$10)`,
      [
        input.worldId,
        input.realm,
        frameId,
        input.principalId,
        input.purpose,
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        JSON.stringify({ securityRevision: world.rows[0]!.security_revision }),
        JSON.stringify(input.payload),
        [],
        expires,
      ],
    );
    await client.query('COMMIT');
    return ok(
      Object.freeze({
        frameId: uuid(frameId),
        worldId: input.worldId,
        realm: input.realm,
        principalId: input.principalId,
        purpose: input.purpose,
        securityRevisionAtCompose: world.rows[0]!.security_revision,
        payload: Object.freeze({ ...input.payload }),
      }),
    );
  } catch {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return fail('Unavailable', 'COMPOSE_FRAME_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Final disclosure check — after revocation/emergency, suppress payload and audit.
 * Does not claim to retract already-delivered content.
 */
export async function finalizeDisclosure(
  pool: Pool,
  draft: FrameDraft,
): Promise<Result<DisclosureSent | DisclosureSuppressed>> {
  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await beginWorld(client, draft.worldId, draft.realm);
        const world = await client.query<{ security_revision: string; emergency_deny: boolean }>(
          `SELECT security_revision::text, emergency_deny FROM ontology.worlds
           WHERE world_id = $1::uuid AND realm = $2`,
          [draft.worldId, draft.realm],
        );
        if (world.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail('NotFoundOrDenied', 'WORLD');
        }
        const w = world.rows[0]!;
        const membership = await client.query<{ state: string }>(
          `SELECT state FROM ontology.memberships
           WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
          [draft.worldId, draft.realm, draft.principalId],
        );
        const active = membership.rows.length > 0 && membership.rows[0]!.state === 'active';
        const suppressCode = w.emergency_deny
          ? 'EMERGENCY_DENY'
          : !active
            ? 'MEMBERSHIP_REVOKED'
            : w.security_revision !== draft.securityRevisionAtCompose
              ? 'SECURITY_REVISION'
              : null;

        if (suppressCode) {
          const auditId = await writeAudit(client, {
            worldId: draft.worldId,
            realm: draft.realm,
            kind: 'DisclosureSuppressed',
            principalId: draft.principalId,
            securityRevision: w.security_revision,
            detail: {
              frameId: draft.frameId,
              code: suppressCode,
              note: 'Already-delivered content is not recalled',
            },
          });
          await client.query('COMMIT');
          return ok(
            Object.freeze({
              tag: 'DisclosureSuppressed' as const,
              frameId: draft.frameId,
              code: suppressCode,
              auditId: uuid(auditId),
            }),
          );
        }

        await client.query('COMMIT');
        return ok(
          Object.freeze({
            tag: 'DisclosureSent' as const,
            frameId: draft.frameId,
            payload: draft.payload,
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
        if (code === '40001' || code === '40P01') {
          if (attempt < 2) continue;
          return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
        }
        throw error;
      }
    }
    return fail('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  } catch {
    return fail('Unavailable', 'FINALIZE_DISCLOSURE_FAILED');
  } finally {
    client.release();
  }
}

export async function countAudit(
  pool: Pool,
  worldId: UUID,
  realm: Realm,
  kind: string,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
    await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
    const rows = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ontology.authority_audit
       WHERE world_id = $1::uuid AND realm = $2 AND kind = $3`,
      [worldId, realm, kind],
    );
    return rows.rows[0]?.n ?? 0;
  } finally {
    client.release();
  }
}
