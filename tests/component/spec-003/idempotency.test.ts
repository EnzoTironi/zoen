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
const FIXTURE_SEED = 'zn-0021-idempotency-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/idempotency.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/idempotency.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0021-emit-${process.pid}`);
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

type Fixture = { seed: string; seedDigest: string; purpose: string; domain: string };

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
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

async function registerZn0021Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Authority } = await import(
    '../../../.core-build/packages/ontology/src/authority/transaction.js'
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
    id: 'TouchDomain',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://touch-domain',
    requiresBasis: false,
    published: true,
  });

  function context(principalId: string) {
    return Object.freeze({
      principalId,
      sessionId: 'sess-zn0021',
      authenticatedAt: new Date().toISOString(),
      assurance: 'authenticated' as const,
      actorId: principalId,
      appSessionId: null,
      transport: 'cli' as const,
    });
  }

  function envelope(worldId: string, operationId: string, purpose: string, input: object = {}) {
    return Object.freeze({
      schemaVersion: 1 as const,
      operation: 'TouchDomain',
      operationId,
      worldRef: Object.freeze({ worldId, realm: 'live' as const }),
      purpose,
      expectedBasis: null,
      input: Object.freeze(input),
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
    await pool.query(
      `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
       VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`,
      [genesis.value.worldId, fx.domain],
    );
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

  test('ZN-0021-AC', async () => {
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
        const opId = randomUUID();
        const env = envelope(seeded.worldId, opId, fx.purpose, { amount: 100 });

        const [a, b] = await Promise.all([
          authority.mutate(env, ctx, descriptor, [fx.domain], async () =>
            Object.freeze({ amount: 100 }),
          ),
          authority.mutate(env, ctx, descriptor, [fx.domain], async () =>
            Object.freeze({ amount: 100 }),
          ),
        ]);
        assert.equal(a.commitId, b.commitId);
        assert.equal(JSON.stringify(a.data), JSON.stringify(b.data));

        // Changed amount / intent same key → Conflict
        let conflict = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, opId, fx.purpose, { amount: 200 }),
            ctx,
            descriptor,
            [fx.domain],
            async () => Object.freeze({ amount: 200 }),
          );
        } catch (error: unknown) {
          conflict = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Conflict',
          );
        }
        assert.equal(conflict, true);

        // Later revocation (security revision advance) prevents disclosure
        await pool.query(
          `UPDATE ontology.worlds SET security_revision = security_revision + 1
           WHERE world_id=$1::uuid AND realm='live'`,
          [seeded.worldId],
        );
        let denied = false;
        try {
          await authority.mutate(env, ctx, descriptor, [fx.domain], async () =>
            Object.freeze({ amount: 100 }),
          );
        } catch (error: unknown) {
          denied = true;
          const tag =
            typeof error === 'object' && error && 'tag' in error
              ? String((error as { tag: string }).tag)
              : '';
          assert.equal(tag, 'Denied');
        }
        assert.equal(denied, true);

        const ops = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND operation_id=$2::uuid`,
          [seeded.worldId, opId],
        );
        assert.equal(ops.rows[0]?.n, 1);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0021-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const opId = randomUUID();
        await authority.mutate(
          envelope(seeded.worldId, opId, fx.purpose, { amount: 1 }),
          ctx,
          descriptor,
          [fx.domain],
          async () => Object.freeze({ amount: 1 }),
        );
        const before = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        let conflict = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, opId, fx.purpose, { amount: 2 }),
            ctx,
            descriptor,
            [fx.domain],
            async () => Object.freeze({ amount: 2 }),
          );
        } catch (error: unknown) {
          conflict = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Conflict',
          );
        }
        assert.equal(conflict, true);
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

  test('ZN-0021-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const opId = randomUUID();
        const env = envelope(seeded.worldId, opId, fx.purpose, { once: true });
        const results = await Promise.all(
          Array.from({ length: 8 }, () =>
            authority.mutate(env, ctx, descriptor, [fx.domain], async () =>
              Object.freeze({ once: true }),
            ),
          ),
        );
        assert.equal(new Set(results.map((r) => r.commitId)).size, 1);
        const n = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND operation_id=$2::uuid`,
          [seeded.worldId, opId],
        );
        assert.equal(n.rows[0]?.n, 1);

        // Changed intent at boundary still conflicts; no second row
        let conflict = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, opId, fx.purpose, { once: false }),
            ctx,
            descriptor,
            [fx.domain],
            async () => Object.freeze({ once: false }),
          );
        } catch (error: unknown) {
          conflict = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Conflict',
          );
        }
        assert.equal(conflict, true);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0021Tests();
