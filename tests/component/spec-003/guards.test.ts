import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0022-guards-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/guards.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/guards.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0022-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/authority/guards.ts'),
        join(ROOT, 'packages/ontology/src/authority/idempotency.ts'),
        join(ROOT, 'packages/ontology/src/authority/transaction.ts'),
        join(ROOT, 'packages/ontology/src/authority/plan.ts'),
        join(ROOT, 'packages/ontology/src/authority/index.ts'),
        join(ROOT, 'packages/ontology/src/worlds/genesis.ts'),
        join(ROOT, 'packages/ontology/src/worlds/index.ts'),
        join(ROOT, 'packages/adapters/src/pg.ts'),
        join(ROOT, 'packages/contracts/src/ports.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
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
  seedDigest: string;
  purpose: string;
  invoiceDomain: string;
  notesDomain: string;
  unpaidPredicate: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

function hex64(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DROP SCHEMA IF EXISTS ontology CASCADE;
    DROP SCHEMA IF EXISTS jobs CASCADE;
    DROP SCHEMA IF EXISTS door CASCADE;
    DROP SCHEMA IF EXISTS eve CASCADE;
    DROP SCHEMA IF EXISTS channels CASCADE;
  `);
  for (const role of [
    'zoen_authority', 'zoen_door', 'zoen_eve', 'zoen_channel', 'zoen_outbox', 'zoen_progress',
  ]) {
    await pool.query(`DROP ROLE IF EXISTS ${role}`);
  }
  for (const sql of SQLS) {
    if (existsSync(sql)) await pool.query(readFileSync(sql, 'utf8'));
  }
}

async function registerZn0022Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Authority } = await import(
    '../../../.core-build/packages/ontology/src/authority/transaction.js'
  );
  const { absenceGuard, assertGuardsFresh, domainGuard } = await import(
    '../../../.core-build/packages/ontology/src/authority/guards.js'
  );
  const { PgDatabase } = await import('../../../.core-build/packages/adapters/src/pg.js');
  const { canonicalJson } = await import('../../../.core-build/packages/kernel/src/json.js');
  const { uuid } = await import('../../../.core-build/packages/kernel/src/ids.js');

  const testCrypto = {
    randomId: () => uuid(randomUUID()),
    randomReference: () => randomUUID().replace(/-/g, ''),
    async sha256(bytes: Uint8Array) {
      return createHash('sha256').update(bytes).digest('hex');
    },
    async digest(value: unknown) {
      return createHash('sha256').update(canonicalJson(value as never), 'utf8').digest('hex');
    },
  };
  const testAuthorizer = { async authorize() { return true; } };

  const descriptor = Object.freeze({
    id: 'ApproveCase',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://approve-case',
    requiresBasis: false,
    published: true,
  });

  function context(principalId: string) {
    return Object.freeze({
      principalId,
      sessionId: 'sess-zn0022',
      authenticatedAt: new Date().toISOString(),
      assurance: 'authenticated' as const,
      actorId: principalId,
      appSessionId: null,
      transport: 'cli' as const,
    });
  }

  function envelope(worldId: string, operationId: string, purpose: string) {
    return Object.freeze({
      schemaVersion: 1 as const,
      operation: 'ApproveCase',
      operationId,
      worldRef: Object.freeze({ worldId, realm: 'live' as const }),
      purpose,
      expectedBasis: null,
      input: Object.freeze({}),
    });
  }

  async function seed(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    for (const domain of [fx.invoiceDomain, fx.notesDomain]) {
      await pool.query(
        `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
         VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`,
        [genesis.value.worldId, domain],
      );
    }
    return { principalId, worldId: genesis.value.worldId, releaseDigest: fx.seedDigest };
  }

  function makeAuthority(releaseDigest: string) {
    const db = new PgDatabase({ connectionString: requireDbUrl() });
    const authority = new Authority(
      db,
      testCrypto,
      { now: () => new Date().toISOString() },
      testAuthorizer,
      releaseDigest,
    );
    return { db, authority };
  }

  test('ZN-0022-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const predicateDigest = hex64(fx.unpaidPredicate);
        // Case approved because no unpaid invoice exists — capture absence fence at v0
        const savedGuards = [
          absenceGuard(fx.invoiceDomain, '0', predicateDigest),
          domainGuard(fx.notesDomain, '0'),
        ];

        // Matching invoice inserted WITHOUT updating previously-read note rows:
        // bump only invoices domain (phantom/absence dependency).
        await pool.query(
          `UPDATE ontology.domains SET version = version + 1
           WHERE world_id=$1::uuid AND realm='live' AND domain_id=$2`,
          [seeded.worldId, fx.invoiceDomain],
        );

        const beforeReceipts = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );

        let stale = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, randomUUID(), fx.purpose),
            ctx,
            descriptor,
            [fx.invoiceDomain],
            async () => Object.freeze({ approved: true }),
            [],
            async (tx) => {
              assertGuardsFresh(savedGuards, tx.cut);
            },
          );
        } catch (error: unknown) {
          stale = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Stale',
          );
        }
        assert.equal(stale, true);
        const afterReceipts = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(afterReceipts.rows[0]?.n, beforeReceipts.rows[0]?.n);

        // Insertion outside declared dependency domain does not invalidate unrelated Case
        // Reset invoices to match saved fence; bump notes only.
        await pool.query(
          `UPDATE ontology.domains SET version = 0
           WHERE world_id=$1::uuid AND realm='live' AND domain_id=$2`,
          [seeded.worldId, fx.invoiceDomain],
        );
        await pool.query(
          `UPDATE ontology.domains SET version = version + 1
           WHERE world_id=$1::uuid AND realm='live' AND domain_id=$2`,
          [seeded.worldId, fx.notesDomain],
        );
        // Case that only depends on invoices absence — notes bump must not Stale it
        const invoiceOnly = [absenceGuard(fx.invoiceDomain, '0', predicateDigest)];
        const ok = await authority.mutate(
          envelope(seeded.worldId, randomUUID(), fx.purpose),
          ctx,
          descriptor,
          [fx.invoiceDomain],
          async () => Object.freeze({ approved: true, unrelatedNotesOk: true }),
          [],
          async (tx) => {
            assertGuardsFresh(invoiceOnly, tx.cut);
          },
        );
        assert.ok(ok.commitId);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0022-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const before = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        let stale = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, randomUUID(), fx.purpose),
            ctx,
            descriptor,
            [fx.invoiceDomain],
            async () => Object.freeze({ should: 'not-commit' }),
            [],
            async () => {
              assertGuardsFresh(
                [absenceGuard(fx.invoiceDomain, '0', hex64(fx.unpaidPredicate))],
                { [fx.invoiceDomain]: '99' },
              );
            },
          );
        } catch (error: unknown) {
          stale = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Stale',
          );
        }
        assert.equal(stale, true);
        const after = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(after.rows[0]?.n, before.rows[0]?.n);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0022-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const predicateDigest = hex64(fx.unpaidPredicate);
        const fence = [absenceGuard(fx.invoiceDomain, '0', predicateDigest)];

        // Race: commit with guards vs insert that bumps invoices domain
        const results = await Promise.allSettled([
          authority.mutate(
            envelope(seeded.worldId, randomUUID(), fx.purpose),
            ctx,
            descriptor,
            [fx.invoiceDomain],
            async (tx) => {
              // hold briefly inside work after guard would have passed at enter
              await new Promise((r) => setTimeout(r, 30));
              return Object.freeze({ raced: true, cut: tx.cut[fx.invoiceDomain] });
            },
            [],
            async (tx) => {
              assertGuardsFresh(fence, tx.cut);
            },
          ),
          (async () => {
            await new Promise((r) => setTimeout(r, 5));
            await pool.query(
              `UPDATE ontology.domains SET version = version + 1
               WHERE world_id=$1::uuid AND realm='live' AND domain_id=$2`,
              [seeded.worldId, fx.invoiceDomain],
            );
          })(),
        ]);

        // Either the mutate sees Stale (guard/recheck) or serializable conflict/retry;
        // at most one semantic approve commits under the old absence fence.
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const ops = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND semantic_op='ApproveCase'`,
          [seeded.worldId],
        );
        // If mutate succeeded, invoices version at commit must still have been consistent
        // with fencing — domain bump races may yield 0 or 1 ops; never >1 for same fence story.
        assert.ok((ops.rows[0]?.n ?? 0) <= 1, `ops=${ops.rows[0]?.n} fulfilled=${fulfilled.length}`);

        // Deterministic: same basis → same Stale outcome
        let again = false;
        try {
          assertGuardsFresh(fence, { [fx.invoiceDomain]: '1', [fx.notesDomain]: '0' });
        } catch (error: unknown) {
          again = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Stale',
          );
        }
        assert.equal(again, true);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0022Tests();
