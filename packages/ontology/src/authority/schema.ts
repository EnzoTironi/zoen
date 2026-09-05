/**
 * Owner-scoped SQL schema and migration discipline (ZN-0019).
 * Phases: expand → backfill → validate → contract. Runtime roles cannot DDL.
 */
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { fail, ok, type Result } from '../../../kernel/src/result.js';

export const MIGRATION_PHASES = ['expand', 'backfill', 'validate', 'contract'] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

export const AUTHORITY_TABLES = [
  'worlds',
  'memberships',
  'domains',
  'commits',
  'receipts',
  'operations',
  'bootstrap_operations',
  'sources',
  'subjects',
  'evidence',
  'claims',
  'claim_evidence',
  'claim_edges',
  'frames',
  'schema_migration_ledger',
] as const;

export const SCHEMA_ROLES = ['zoen_authority', 'zoen_progress', 'zoen_outbox'] as const;

export type SchemaDisciplineReport = Readonly<{
  tag: 'SchemaDisciplineReport';
  tablesPresent: boolean;
  ledgerPhases: readonly string[];
  runtimeCannotDdl: boolean;
  progressCannotWriteAuthority: boolean;
  observations: readonly string[];
}>;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function asRole<T>(client: PoolClient, role: string, fn: () => Promise<T>): Promise<T> {
  await client.query(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await client.query('RESET ROLE');
  }
}

async function expectFail(client: PoolClient, sql: string, params: unknown[] = []): Promise<string> {
  await client.query('SAVEPOINT zn0019_probe');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT zn0019_probe');
    return 'UNEXPECTED_SUCCESS';
  } catch (error: unknown) {
    await client.query('ROLLBACK TO SAVEPOINT zn0019_probe');
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code: string }).code)
        : 'ERR';
    return code;
  }
}

/** Record one expand/backfill/validate/contract phase; identical digest is idempotent. */
export async function recordMigrationPhase(
  pool: Pool,
  migrationName: string,
  phase: MigrationPhase,
  sqlBody: string,
): Promise<Result<{ recorded: boolean; sha256: string }>> {
  if (!/^[a-z0-9][a-z0-9_.-]{0,127}$/.test(migrationName)) {
    return fail('InvalidInput', 'MIGRATION_NAME');
  }
  if (!(MIGRATION_PHASES as readonly string[]).includes(phase)) {
    return fail('InvalidInput', 'MIGRATION_PHASE');
  }
  const digest = sha256Text(sqlBody);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ sha256: string }>(
      `SELECT sha256 FROM ontology.schema_migration_ledger
       WHERE migration_name = $1 AND phase = $2`,
      [migrationName, phase],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].sha256 !== digest) {
        await client.query('ROLLBACK');
        return fail('Conflict', 'MIGRATION_BYTES_CHANGED');
      }
      await client.query('COMMIT');
      return ok({ recorded: false, sha256: digest });
    }
    // Execute phase body only once; empty body is a bookkeeping marker.
    if (sqlBody.trim().length > 0) {
      await client.query(sqlBody);
    }
    await client.query(
      `INSERT INTO ontology.schema_migration_ledger(migration_name, phase, sha256)
       VALUES ($1, $2, $3)`,
      [migrationName, phase, digest],
    );
    await client.query('COMMIT');
    return ok({ recorded: true, sha256: digest });
  } catch (error: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* preserve */
    }
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    // Concurrent same-intent insert: unique_violation → re-read winner
    if (code === '23505') {
      const winner = await pool.query<{ sha256: string }>(
        `SELECT sha256 FROM ontology.schema_migration_ledger
         WHERE migration_name = $1 AND phase = $2`,
        [migrationName, phase],
      );
      if (winner.rows[0]?.sha256 === digest) {
        return ok({ recorded: false, sha256: digest });
      }
      return fail('Conflict', 'MIGRATION_BYTES_CHANGED');
    }
    const msg = error instanceof Error ? error.message : 'phase-failed';
    return fail('Unavailable', 'MIGRATION_PHASE_FAILED');
  } finally {
    client.release();
  }
}

/** Apply all four phases in order; skip already-applied matching digests (resume-safe). */
export async function applyMigrationPlan(
  pool: Pool,
  migrationName: string,
  phases: Readonly<Partial<Record<MigrationPhase, string>>>,
): Promise<Result<{ applied: readonly string[]; skipped: readonly string[] }>> {
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const phase of MIGRATION_PHASES) {
    const body = phases[phase] ?? '';
    const result = await recordMigrationPhase(pool, migrationName, phase, body);
    if (result.tag !== 'Ok') return result;
    if (result.value.recorded) applied.push(phase);
    else skipped.push(phase);
  }
  return ok({
    applied: Object.freeze(applied),
    skipped: Object.freeze(skipped),
  });
}

/** Confirm expected ontology tables exist after migrations. */
export async function assertAuthorityTables(pool: Pool): Promise<Result<true>> {
  const rows = await pool.query<{ relname: string }>(
    `SELECT relname FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'ontology' AND c.relkind = 'r'
       AND relname = ANY($1::text[])`,
    [AUTHORITY_TABLES as unknown as string[]],
  );
  if (rows.rows.length !== AUTHORITY_TABLES.length) {
    return fail('Unavailable', 'AUTHORITY_TABLES_MISSING');
  }
  return ok(true);
}

/** Probe: runtime roles cannot DDL; progress cannot write authority rows. */
export async function probeSchemaDiscipline(pool: Pool): Promise<Result<SchemaDisciplineReport>> {
  const observations: string[] = [];
  const tables = await assertAuthorityTables(pool);
  if (tables.tag !== 'Ok') return tables;

  const ledger = await pool.query<{ phase: string }>(
    `SELECT phase FROM ontology.schema_migration_ledger
     WHERE migration_name = 'zn-0019_schema' ORDER BY phase`,
  );
  const ledgerPhases = ledger.rows.map((r) => r.phase);

  let runtimeCannotDdl = true;
  let progressCannotWriteAuthority = true;

  const client = await pool.connect();
  try {
    for (const role of ['zoen_authority', 'zoen_progress'] as const) {
      await client.query('BEGIN');
      try {
        const ddl = await asRole(client, role, () =>
          expectFail(client, 'CREATE TABLE ontology._zn0019_should_fail(id int)'),
        );
        observations.push(`${role}:ddl=${ddl}`);
        if (ddl === 'UNEXPECTED_SUCCESS') runtimeCannotDdl = false;
      } finally {
        await client.query('ROLLBACK');
      }
    }

    await client.query('BEGIN');
    try {
      const progressWrite = await asRole(client, 'zoen_progress', () =>
        expectFail(
          client,
          `INSERT INTO ontology.operations(
             world_id, realm, principal_id, semantic_op, operation_id,
             intent_digest, result_ref, commit_id
           ) VALUES (gen_random_uuid(),'live',gen_random_uuid(),'X',gen_random_uuid(),
                     repeat('a',64), gen_random_uuid(), gen_random_uuid())`,
        ),
      );
      observations.push(`zoen_progress:authorityWrite=${progressWrite}`);
      if (progressWrite === 'UNEXPECTED_SUCCESS') progressCannotWriteAuthority = false;
    } finally {
      await client.query('ROLLBACK');
    }

    // Changed bytes for same phase must Conflict (no duplicate / silent overwrite).
    const first = await recordMigrationPhase(pool, 'zn-0019_probe', 'expand', 'SELECT 1');
    observations.push(`probeExpand=${first.tag}`);
    if (first.tag === 'Ok') {
      const conflict = await recordMigrationPhase(pool, 'zn-0019_probe', 'expand', 'SELECT 2');
      const code = conflict.tag !== 'Ok' && 'code' in conflict ? String(conflict.code) : '';
      observations.push(`probeConflict=${conflict.tag}:${code}`);
      if (conflict.tag === 'Ok' || code !== 'MIGRATION_BYTES_CHANGED') {
        observations.push('UNEXPECTED_DIGEST_ACCEPT');
        runtimeCannotDdl = false;
      }
    }
  } finally {
    client.release();
  }

  return ok(
    Object.freeze({
      tag: 'SchemaDisciplineReport' as const,
      tablesPresent: true,
      ledgerPhases: Object.freeze(ledgerPhases),
      runtimeCannotDdl,
      progressCannotWriteAuthority,
      observations: Object.freeze(observations),
    }),
  );
}
