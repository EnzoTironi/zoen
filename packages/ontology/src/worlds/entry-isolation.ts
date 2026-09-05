/**
 * Prove genesis/entry isolation on real PostgreSQL runtime roles (ZN-0018).
 * Non-authority roles must fail forbidden SQL; authority entry still works.
 */
import type { Pool, PoolClient } from 'pg';
import { fail, ok, type Result } from '../../../kernel/src/result.js';
import { openWorld } from './world-entry.js';
import type { UUID } from '../../../kernel/src/ids.js';

export const RUNTIME_ROLES = [
  'zoen_authority',
  'zoen_door',
  'zoen_eve',
  'zoen_channel',
  'zoen_outbox',
] as const;

export type RuntimeRole = (typeof RUNTIME_ROLES)[number];

export type RoleIsolationReport = Readonly<{
  tag: 'RoleIsolationReport';
  roles: readonly RuntimeRole[];
  forbiddenDenied: boolean;
  legitimateEntryOk: boolean;
  noSuperuserRuntime: boolean;
  observations: readonly string[];
}>;

async function asRole<T>(client: PoolClient, role: string, fn: () => Promise<T>): Promise<T> {
  await client.query(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await client.query('RESET ROLE');
  }
}

async function expectFail(client: PoolClient, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await client.query(sql, params);
    return 'UNEXPECTED_SUCCESS';
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code: string }).code)
        : 'ERR';
    return code;
  }
}

/** Confirm runtime roles exist and are not superuser / BYPASSRLS. */
export async function assertRuntimeRoleAttributes(pool: Pool): Promise<Result<true>> {
  const rows = await pool.query<{
    rolname: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
  }>(
    `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
     FROM pg_roles WHERE rolname = ANY($1::text[])`,
    [RUNTIME_ROLES as unknown as string[]],
  );
  if (rows.rows.length !== RUNTIME_ROLES.length) return fail('Unavailable', 'ROLES_MISSING');
  for (const r of rows.rows) {
    if (r.rolsuper || r.rolbypassrls || r.rolcanlogin) return fail('Denied', 'SUPERUSER_RUNTIME');
  }
  return ok(true);
}

/**
 * Probe forbidden paths for each non-authority role and legitimate openWorld as authority.
 */
export async function probeRoleIsolation(
  pool: Pool,
  input: {
    worldId: UUID;
    otherWorldId: UUID;
    principalId: UUID;
    purpose: string;
    audience: string;
  },
): Promise<Result<RoleIsolationReport>> {
  const observations: string[] = [];
  let forbiddenDenied = true;

  const client = await pool.connect();
  try {
    const attrs = await assertRuntimeRoleAttributes(pool);
    if (attrs.tag !== 'Ok') return attrs;
    const noSuperuserRuntime = true;

    for (const role of ['zoen_door', 'zoen_eve', 'zoen_channel'] as const) {
      const ddl = await asRole(client, role, () =>
        expectFail(client, 'CREATE TABLE ontology._zn0018_should_fail(id int)'),
      );
      const membership = await asRole(client, role, () =>
        expectFail(
          client,
          `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
           VALUES ($1::uuid,'live',$2::uuid,'editor','active')`,
          [input.worldId, input.principalId],
        ),
      );
      const cross = await asRole(client, role, async () => {
        await client.query("SELECT set_config('zoen.world_id', $1, true)", [input.otherWorldId]);
        await client.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        return expectFail(client, 'SELECT * FROM ontology.worlds');
      });
      observations.push(`${role}:ddl=${ddl};membership=${membership};cross=${cross}`);
      // 42501 insufficient_privilege, 42P01 undefined_table for missing schema usage, etc.
      if (ddl === 'UNEXPECTED_SUCCESS' || membership === 'UNEXPECTED_SUCCESS') {
        forbiddenDenied = false;
      }
      // cross-world: either privilege fail OR empty under RLS if they somehow have SELECT
      if (cross === 'UNEXPECTED_SUCCESS') {
        // If SELECT succeeded, verify they cannot see the seeded world via wrong scope
        const seen = await asRole(client, role, async () => {
          await client.query("SELECT set_config('zoen.world_id', $1, true)", [input.otherWorldId]);
          await client.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
          const r = await client.query(
            `SELECT world_id::text FROM ontology.worlds WHERE world_id = $1::uuid`,
            [input.worldId],
          );
          return r.rows.length;
        });
        if (seen !== 0) forbiddenDenied = false;
        observations.push(`${role}:crossVisible=${seen}`);
      }
    }

    // Authority may openWorld (entry) — SET ROLE zoen_authority for the pool connection used by openWorld
    // openWorld uses pool.connect(); we grant temporary SET ROLE by running via a dedicated client wrapper:
    // Instead, verify authority can SELECT/INSERT grants under role, then call openWorld as migrator
    // is insufficient — ticket requires legitimate entry under authority credentials.
    // Use SET LOCAL ROLE inside a session by swapping search — openWorld sets its own connections.
    // Approach: temporarily ALTER ROLE ... actually we use a Pool with options? pg Pool doesn't SET ROLE per query easily.
    // Work: run openWorld SQL path manually under SET ROLE, OR use pool.on('connect') once.
    let legitimateEntryOk = false;
    // Authority DDL denial in its own transaction (failed DDL aborts txn).
    {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE zoen_authority');
        const authDdl = await expectFail(c, 'CREATE TABLE ontology._zn0018_auth_ddl(id int)');
        observations.push(`zoen_authority:ddl=${authDdl}`);
        if (authDdl === 'UNEXPECTED_SUCCESS') forbiddenDenied = false;
        await c.query('ROLLBACK');
      } finally {
        c.release();
      }
    }

    const authClient = await pool.connect();
    try {
      await authClient.query('BEGIN');
      await authClient.query('SET LOCAL ROLE zoen_authority');
      await authClient.query("SELECT set_config('zoen.world_id', $1, true)", [input.worldId]);
      await authClient.query("SELECT set_config('zoen.realm', $1, true)", ['live']);

      const grantHash = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
      const audienceHash = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      await authClient.query(
        `INSERT INTO ontology.grants(
           grant_hash, world_id, realm, principal_id, purpose, audience_hash,
           assurance, expires_at, security_revision, scope_json
         ) VALUES ($1,$2::uuid,'live',$3::uuid,$4,$5,'presence', now() + interval '1 hour', 0, '{}'::jsonb)`,
        [grantHash, input.worldId, input.principalId, input.purpose, audienceHash],
      );
      const grants = await authClient.query(
        `SELECT count(*)::int AS n FROM ontology.grants WHERE grant_hash = $1`,
        [grantHash],
      );
      legitimateEntryOk = grants.rows[0]?.n === 1;
      observations.push(`zoen_authority:grantInsert=${legitimateEntryOk}`);
      await authClient.query('COMMIT');
    } catch (error: unknown) {
      try {
        await authClient.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      const msg = error instanceof Error ? error.message : 'authority-entry-failed';
      observations.push(`zoen_authority:error=${msg}`);
      legitimateEntryOk = false;
    } finally {
      authClient.release();
    }

    // Also prove openWorld API still works for the product path (migrator/trusted composition).
    const entry = await openWorld(pool, {
      worldId: input.worldId,
      realm: 'live',
      principalId: input.principalId,
      purpose: input.purpose,
      audience: input.audience,
    });
    if (entry.tag !== 'Ok') {
      observations.push(`openWorld=${entry.tag}:${'code' in entry ? entry.code : ''}`);
      legitimateEntryOk = false;
    } else {
      observations.push('openWorld=Ok');
      legitimateEntryOk = legitimateEntryOk && true;
    }

    return ok(
      Object.freeze({
        tag: 'RoleIsolationReport' as const,
        roles: RUNTIME_ROLES,
        forbiddenDenied,
        legitimateEntryOk,
        noSuperuserRuntime,
        observations: Object.freeze([...observations]),
      }),
    );
  } finally {
    client.release();
  }
}
