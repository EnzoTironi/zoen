import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0019-schema-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/schema.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/schema.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0019_schema.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0019-emit-${process.pid}`);
  mkdirSync(cfgDir, { recursive: true });
  const cfg = join(cfgDir, 'tsconfig.json');
  writeFileSync(
    cfg,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2023', 'DOM'],
        types: [],
        strict: true,
        skipLibCheck: true,
        noEmitOnError: true,
        rootDir: join(ROOT, 'packages'),
        outDir: join(OUT, 'packages'),
        declaration: false,
      },
      include: [
        join(ROOT, 'packages/ontology/src/authority/schema.ts'),
        join(ROOT, 'packages/ontology/src/authority/types.ts'),
        join(ROOT, 'packages/ontology/src/authority/ports.ts'),
        join(ROOT, 'packages/ontology/src/authority/index.ts'),
        join(ROOT, 'packages/ontology/src/authority/plan.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
      ],
    }),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();

type Fixture = {
  seed: string;
  migrationName: string;
  phases: string[];
  authorityTables: string[];
  runtimeRoles: string[];
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

async function resetSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DROP SCHEMA IF EXISTS ontology CASCADE;
    DROP SCHEMA IF EXISTS jobs CASCADE;
    DROP SCHEMA IF EXISTS door CASCADE;
    DROP SCHEMA IF EXISTS eve CASCADE;
    DROP SCHEMA IF EXISTS channels CASCADE;
  `);
  for (const role of [
    'zoen_authority',
    'zoen_door',
    'zoen_eve',
    'zoen_channel',
    'zoen_outbox',
    'zoen_progress',
  ]) {
    await pool.query(`DROP ROLE IF EXISTS ${role}`);
  }
  for (const sql of SQLS) await pool.query(readFileSync(sql, 'utf8'));
}

async function registerZn0019Tests(): Promise<void> {
  const {
    applyMigrationPlan,
    recordMigrationPhase,
    probeSchemaDiscipline,
    MIGRATION_PHASES,
    AUTHORITY_TABLES,
  } = await import('../../../.core-build/packages/ontology/src/authority/schema.js');

  test('ZN-0019-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.deepEqual(fx.phases, [...MIGRATION_PHASES]);
    assert.deepEqual(fx.authorityTables, [...AUTHORITY_TABLES]);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetSchema(pool);

      // Fresh path: apply all four phases
      const fresh = await applyMigrationPlan(pool, fx.migrationName, {
        expand: 'SELECT 1',
        backfill: 'SELECT 1',
        validate: 'SELECT 1',
        contract: 'SELECT 1',
      });
      assert.equal(fresh.tag, 'Ok', JSON.stringify(fresh));
      if (fresh.tag !== 'Ok') return;
      assert.deepEqual([...fresh.value.applied], ['expand', 'backfill', 'validate', 'contract']);
      assert.deepEqual([...fresh.value.skipped], []);

      // Midway failure then resume: new migration name, fail at backfill, then resume
      const midName = 'zn-0019_midway';
      const expand = await recordMigrationPhase(pool, midName, 'expand', 'SELECT 1');
      assert.equal(expand.tag, 'Ok');
      const failBackfill = await recordMigrationPhase(
        pool,
        midName,
        'backfill',
        'SELECT 1 FROM ontology.__does_not_exist_zn0019',
      );
      assert.notEqual(failBackfill.tag, 'Ok');

      const resume = await applyMigrationPlan(pool, midName, {
        expand: 'SELECT 1',
        backfill: 'SELECT 1',
        validate: 'SELECT 1',
        contract: 'SELECT 1',
      });
      assert.equal(resume.tag, 'Ok', JSON.stringify(resume));
      if (resume.tag !== 'Ok') return;
      assert.ok(resume.value.skipped.includes('expand'));
      assert.ok(resume.value.applied.includes('backfill'));
      assert.ok(resume.value.applied.includes('validate'));
      assert.ok(resume.value.applied.includes('contract'));

      // No duplicate history for primary migration
      const counts = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ontology.schema_migration_ledger
         WHERE migration_name = $1`,
        [fx.migrationName],
      );
      assert.equal(counts.rows[0]?.n, 4);

      const report = await probeSchemaDiscipline(pool);
      assert.equal(report.tag, 'Ok', JSON.stringify(report));
      if (report.tag !== 'Ok') return;
      assert.equal(report.value.tablesPresent, true);
      assert.equal(report.value.runtimeCannotDdl, true, report.value.observations.join('|'));
      assert.equal(
        report.value.progressCannotWriteAuthority,
        true,
        report.value.observations.join('|'),
      );
    } finally {
      await pool.end();
    }
  });

  test('ZN-0019-NEG', async () => {
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetSchema(pool);
      await applyMigrationPlan(pool, 'zn-0019_schema', {
        expand: 'SELECT 1',
        backfill: 'SELECT 1',
        validate: 'SELECT 1',
        contract: 'SELECT 1',
      });

      // Changed intent / bytes for same phase → Conflict; no second row
      const a = await recordMigrationPhase(pool, 'zn-0019_neg', 'expand', 'SELECT 1');
      assert.equal(a.tag, 'Ok');
      const b = await recordMigrationPhase(pool, 'zn-0019_neg', 'expand', 'SELECT 2');
      assert.equal(b.tag, 'Conflict');
      assert.equal('code' in b ? b.code : '', 'MIGRATION_BYTES_CHANGED');

      const n = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ontology.schema_migration_ledger
         WHERE migration_name = 'zn-0019_neg'`,
      );
      assert.equal(n.rows[0]?.n, 1);

      // Runtime DDL denied
      const client = await pool.connect();
      try {
        await client.query('SET ROLE zoen_authority');
        let failed = false;
        try {
          await client.query('CREATE TABLE ontology.pwned_zn0019(id int)');
        } catch {
          failed = true;
        }
        assert.equal(failed, true);
        await client.query('RESET ROLE');
      } finally {
        try {
          await client.query('RESET ROLE');
        } catch {
          /* ignore */
        }
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0019-BOUNDARY', async () => {
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetSchema(pool);

      // Concurrent same-intent phase apply: at most one semantic insert
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          recordMigrationPhase(pool, 'zn-0019_race', 'expand', 'SELECT 42'),
        ),
      );
      const oks = results.filter((r) => r.tag === 'Ok');
      assert.equal(oks.length, 8);
      const recorded = oks.filter((r) => r.tag === 'Ok' && r.value.recorded);
      assert.equal(recorded.length, 1, JSON.stringify(results));

      const n = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ontology.schema_migration_ledger
         WHERE migration_name = 'zn-0019_race' AND phase = 'expand'`,
      );
      assert.equal(n.rows[0]?.n, 1);

      // Resume after "crash" (partial plan) is deterministic
      const resume = await applyMigrationPlan(pool, 'zn-0019_race', {
        expand: 'SELECT 42',
        backfill: 'SELECT 1',
        validate: 'SELECT 1',
        contract: 'SELECT 1',
      });
      assert.equal(resume.tag, 'Ok');
      if (resume.tag !== 'Ok') return;
      assert.deepEqual([...resume.value.skipped], ['expand']);
      assert.deepEqual([...resume.value.applied], ['backfill', 'validate', 'contract']);
    } finally {
      await pool.end();
    }
  });
}

await registerZn0019Tests();
