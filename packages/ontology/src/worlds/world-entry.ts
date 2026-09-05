/**
 * Purpose-bound World entry grants and request permits (OpenWorld).
 * Opaque tokens are minted randomly; only hashes are stored. Focus must not embed secrets.
 */
import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalDigest } from '../../../kernel/src/json.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { fail, ok, type Result } from '../../../kernel/src/result.js';

const DIGEST_RE = /^[a-f0-9]{64}$/;
const PURPOSE_RE = /^[a-z][a-z0-9_.-]{0,127}$/;
const REALMS = new Set(['live', 'evaluation'] as const);
type Realm = 'live' | 'evaluation';

export type OpenWorldInput = Readonly<{
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  purpose: string;
  /** Opaque audience label; hashed before storage. */
  audience: string;
  assurance?: string;
  /** Wall-clock override for tests only — never expose on production routes. */
  now?: Date;
  ttlSeconds?: number;
}>;

export type GrantRef = Readonly<{
  tag: 'GrantRef';
  grantHash: string;
  worldId: UUID;
  realm: Realm;
  purpose: string;
  audienceHash: string;
  assurance: string;
  expiresAt: string;
  securityRevision: string;
  /** Opaque secret returned once at mint; never persist into Focus/links. */
  grantToken: string;
}>;

export type IssuePermitInput = Readonly<{
  grantToken: string;
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  semanticOp: string;
  /** Canonical request body object — digested; altered body fails authorize. */
  body: Readonly<Record<string, unknown>>;
  audience: string;
  now?: Date;
  ttlSeconds?: number;
}>;

export type RequestPermitRef = Readonly<{
  tag: 'RequestPermitRef';
  permitHash: string;
  grantHash: string;
  worldId: UUID;
  realm: Realm;
  semanticOp: string;
  bodyDigest: string;
  audienceHash: string;
  cellEpoch: string;
  securityRevision: string;
  expiresAt: string;
  /** Opaque secret returned once at mint; never persist into Focus/links. */
  permitToken: string;
}>;

export type AuthorizePermitInput = Readonly<{
  permitToken: string;
  worldId: UUID;
  realm: Realm;
  principalId: UUID;
  semanticOp: string;
  body: Readonly<Record<string, unknown>>;
  audience: string;
  now?: Date;
}>;

function audienceHashOf(audience: string): string {
  return canonicalDigest({ audience } as never);
}

function tokenPair(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = canonicalDigest({ token } as never);
  return { token, hash };
}

function parseIds(input: { worldId: string; principalId: string }): Result<null> {
  try {
    uuid(input.worldId);
    uuid(input.principalId);
    return ok(null);
  } catch {
    return fail('InvalidInput', 'ENTRY_IDS');
  }
}

async function withWorldScope<T>(
  pool: Pool,
  worldId: string,
  realm: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
    await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
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

/**
 * OpenWorld — mint a fresh purpose-bound grant after membership/security checks.
 */
export async function openWorld(pool: Pool, input: OpenWorldInput): Promise<Result<GrantRef>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (!PURPOSE_RE.test(input.purpose)) return fail('InvalidInput', 'PURPOSE');
  if (typeof input.audience !== 'string' || input.audience.length < 1 || input.audience.length > 160) {
    return fail('InvalidInput', 'AUDIENCE');
  }
  const ids = parseIds(input);
  if (ids.tag !== 'Ok') return ids;
  const assurance = input.assurance ?? 'presence';
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(assurance)) return fail('InvalidInput', 'ASSURANCE');
  const ttl = input.ttlSeconds ?? 3600;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86_400) return fail('InvalidInput', 'TTL');
  const now = input.now ?? new Date();
  const audienceHash = audienceHashOf(input.audience);

  try {
    return await withWorldScope(pool, input.worldId, input.realm, async (client) => {
      const world = await client.query<{
        security_revision: string;
        emergency_deny: boolean;
        cell_epoch: string;
      }>(
        `SELECT security_revision::text, emergency_deny, cell_epoch::text
         FROM ontology.worlds WHERE world_id = $1::uuid AND realm = $2`,
        [input.worldId, input.realm],
      );
      if (world.rows.length === 0) return fail('NotFoundOrDenied', 'WORLD');
      const w = world.rows[0]!;
      if (w.emergency_deny) return fail('Denied', 'EMERGENCY_DENY');

      const membership = await client.query<{ role: string; state: string }>(
        `SELECT role, state FROM ontology.memberships
         WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
        [input.worldId, input.realm, input.principalId],
      );
      if (membership.rows.length === 0) return fail('Denied', 'NO_MEMBERSHIP');
      if (membership.rows[0]!.state !== 'active') return fail('Denied', 'MEMBERSHIP_REVOKED');

      const { token, hash } = tokenPair();
      const expiresAt = new Date(now.getTime() + ttl * 1000);
      await client.query(
        `INSERT INTO ontology.grants(
           grant_hash, world_id, realm, principal_id, purpose, audience_hash,
           assurance, expires_at, security_revision, scope_json
         ) VALUES ($1,$2::uuid,$3,$4::uuid,$5,$6,$7,$8,$9::bigint,$10::jsonb)`,
        [
          hash,
          input.worldId,
          input.realm,
          input.principalId,
          input.purpose,
          audienceHash,
          assurance,
          expiresAt.toISOString(),
          w.security_revision,
          JSON.stringify({ cellEpoch: w.cell_epoch }),
        ],
      );

      return ok(
        Object.freeze({
          tag: 'GrantRef' as const,
          grantHash: hash,
          worldId: input.worldId,
          realm: input.realm,
          purpose: input.purpose,
          audienceHash,
          assurance,
          expiresAt: expiresAt.toISOString(),
          securityRevision: w.security_revision,
          grantToken: token,
        }),
      );
    });
  } catch {
    return fail('Unavailable', 'OPEN_WORLD_FAILED');
  }
}

/**
 * Bind an opaque request permit to grant + operation + body + audience + epoch.
 */
export async function issueRequestPermit(
  pool: Pool,
  input: IssuePermitInput,
): Promise<Result<RequestPermitRef>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (!PURPOSE_RE.test(input.semanticOp)) return fail('InvalidInput', 'SEMANTIC_OP');
  if (typeof input.audience !== 'string' || input.audience.length < 1) return fail('InvalidInput', 'AUDIENCE');
  if (typeof input.grantToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.grantToken)) {
    return fail('InvalidInput', 'GRANT_TOKEN');
  }
  const ids = parseIds(input);
  if (ids.tag !== 'Ok') return ids;
  const ttl = input.ttlSeconds ?? 300;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86_400) return fail('InvalidInput', 'TTL');
  const now = input.now ?? new Date();
  const grantHash = canonicalDigest({ token: input.grantToken } as never);
  const audienceHash = audienceHashOf(input.audience);
  const bodyDigest = canonicalDigest(input.body as never);

  try {
    return await withWorldScope(pool, input.worldId, input.realm, async (client) => {
      const grant = await client.query<{
        principal_id: string;
        purpose: string;
        audience_hash: string;
        expires_at: Date;
        security_revision: string;
      }>(
        `SELECT principal_id::text, purpose, audience_hash, expires_at, security_revision::text
         FROM ontology.grants WHERE grant_hash = $1`,
        [grantHash],
      );
      if (grant.rows.length === 0) return fail('Denied', 'GRANT_UNKNOWN');
      const g = grant.rows[0]!;
      if (g.principal_id !== input.principalId) return fail('Denied', 'GRANT_PRINCIPAL');
      if (g.audience_hash !== audienceHash) return fail('Denied', 'GRANT_AUDIENCE');
      if (g.expires_at.getTime() <= now.getTime()) return fail('Expired', 'GRANT_EXPIRED');
      if (g.purpose !== input.semanticOp) return fail('Denied', 'PURPOSE_MISMATCH');

      const world = await client.query<{
        security_revision: string;
        emergency_deny: boolean;
        cell_epoch: string;
      }>(
        `SELECT security_revision::text, emergency_deny, cell_epoch::text
         FROM ontology.worlds WHERE world_id = $1::uuid AND realm = $2`,
        [input.worldId, input.realm],
      );
      if (world.rows.length === 0) return fail('NotFoundOrDenied', 'WORLD');
      const w = world.rows[0]!;
      if (w.emergency_deny) return fail('Denied', 'EMERGENCY_DENY');
      if (w.security_revision !== g.security_revision) return fail('Stale', 'SECURITY_REVISION');

      const membership = await client.query<{ state: string }>(
        `SELECT state FROM ontology.memberships
         WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
        [input.worldId, input.realm, input.principalId],
      );
      if (membership.rows.length === 0 || membership.rows[0]!.state !== 'active') {
        return fail('Denied', 'MEMBERSHIP_REVOKED');
      }

      const { token, hash } = tokenPair();
      const expiresAt = new Date(Math.min(now.getTime() + ttl * 1000, g.expires_at.getTime()));
      await client.query(
        `INSERT INTO ontology.request_permits(
           permit_hash, grant_hash, world_id, realm, principal_id, semantic_op,
           body_digest, audience_hash, cell_epoch, security_revision, expires_at
         ) VALUES ($1,$2,$3::uuid,$4,$5::uuid,$6,$7,$8,$9::bigint,$10::bigint,$11)`,
        [
          hash,
          grantHash,
          input.worldId,
          input.realm,
          input.principalId,
          input.semanticOp,
          bodyDigest,
          audienceHash,
          w.cell_epoch,
          w.security_revision,
          expiresAt.toISOString(),
        ],
      );

      return ok(
        Object.freeze({
          tag: 'RequestPermitRef' as const,
          permitHash: hash,
          grantHash,
          worldId: input.worldId,
          realm: input.realm,
          semanticOp: input.semanticOp,
          bodyDigest,
          audienceHash,
          cellEpoch: w.cell_epoch,
          securityRevision: w.security_revision,
          expiresAt: expiresAt.toISOString(),
          permitToken: token,
        }),
      );
    });
  } catch {
    return fail('Unavailable', 'ISSUE_PERMIT_FAILED');
  }
}

/**
 * Revalidate a request permit at use / before disclosure. No domain writes.
 */
export async function authorizeRequestPermit(
  pool: Pool,
  input: AuthorizePermitInput,
): Promise<Result<{ tag: 'Authorized'; permitHash: string; securityRevision: string }>> {
  if (!REALMS.has(input.realm)) return fail('InvalidInput', 'REALM');
  if (!PURPOSE_RE.test(input.semanticOp)) return fail('InvalidInput', 'SEMANTIC_OP');
  if (typeof input.permitToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.permitToken)) {
    return fail('InvalidInput', 'PERMIT_TOKEN');
  }
  const ids = parseIds(input);
  if (ids.tag !== 'Ok') return ids;
  const now = input.now ?? new Date();
  const permitHash = canonicalDigest({ token: input.permitToken } as never);
  const audienceHash = audienceHashOf(input.audience);
  const bodyDigest = canonicalDigest(input.body as never);

  try {
    return await withWorldScope(pool, input.worldId, input.realm, async (client) => {
      const permit = await client.query<{
        grant_hash: string;
        principal_id: string;
        semantic_op: string;
        body_digest: string;
        audience_hash: string;
        cell_epoch: string;
        security_revision: string;
        expires_at: Date;
        realm: string;
      }>(
        `SELECT grant_hash, principal_id::text, semantic_op, body_digest, audience_hash,
                cell_epoch::text, security_revision::text, expires_at, realm
         FROM ontology.request_permits WHERE permit_hash = $1`,
        [permitHash],
      );
      if (permit.rows.length === 0) return fail('Denied', 'PERMIT_UNKNOWN');
      const p = permit.rows[0]!;
      if (p.realm !== input.realm) return fail('Denied', 'REALM_MISMATCH');
      if (p.principal_id !== input.principalId) return fail('Denied', 'PERMIT_PRINCIPAL');
      if (p.semantic_op !== input.semanticOp) return fail('Denied', 'PURPOSE_MISMATCH');
      if (p.body_digest !== bodyDigest) return fail('Denied', 'BODY_DIGEST');
      if (p.audience_hash !== audienceHash) return fail('Denied', 'AUDIENCE_MISMATCH');
      if (p.expires_at.getTime() <= now.getTime()) return fail('Expired', 'PERMIT_EXPIRED');

      const world = await client.query<{
        security_revision: string;
        emergency_deny: boolean;
        cell_epoch: string;
      }>(
        `SELECT security_revision::text, emergency_deny, cell_epoch::text
         FROM ontology.worlds WHERE world_id = $1::uuid AND realm = $2`,
        [input.worldId, input.realm],
      );
      if (world.rows.length === 0) return fail('NotFoundOrDenied', 'WORLD');
      const w = world.rows[0]!;
      if (w.emergency_deny) return fail('Denied', 'EMERGENCY_DENY');
      if (w.security_revision !== p.security_revision) return fail('Stale', 'SECURITY_REVISION');
      if (w.cell_epoch !== p.cell_epoch) return fail('Stale', 'CELL_EPOCH');

      const membership = await client.query<{ state: string }>(
        `SELECT state FROM ontology.memberships
         WHERE world_id = $1::uuid AND realm = $2 AND principal_id = $3::uuid`,
        [input.worldId, input.realm, input.principalId],
      );
      if (membership.rows.length === 0 || membership.rows[0]!.state !== 'active') {
        return fail('Denied', 'MEMBERSHIP_REVOKED');
      }

      // Read-only authorize path — no domain mutation.
      return ok(
        Object.freeze({
          tag: 'Authorized' as const,
          permitHash,
          securityRevision: w.security_revision,
        }),
      );
    });
  } catch {
    return fail('Unavailable', 'AUTHORIZE_PERMIT_FAILED');
  }
}

/** Test/helper: count domain rows for a world (prove no domain writes on deny). */
export async function countDomains(pool: Pool, worldId: UUID, realm: Realm): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
    await client.query("SELECT set_config('zoen.realm', $1, true)", [realm]);
    const rows = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ontology.domains WHERE world_id = $1::uuid AND realm = $2`,
      [worldId, realm],
    );
    return rows.rows[0]?.n ?? 0;
  } finally {
    client.release();
  }
}
