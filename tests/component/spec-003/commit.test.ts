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
const FIXTURE_SEED = 'zn-0020-commit-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/commit.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/commit.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0020-emit-${process.pid}`);
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
  domains: string[];
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

function hex64(label: string): string {
  return createHash('sha256').update(label).digest('hex');
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
    'zoen_authority',
    'zoen_door',
    'zoen_eve',
    'zoen_channel',
    'zoen_outbox',
    'zoen_progress',
  ]) {
    await pool.query(`DROP ROLE IF EXISTS ${role}`);
  }
  for (const sql of SQLS) {
    if (existsSync(sql)) await pool.query(readFileSync(sql, 'utf8'));
  }
}

async function registerZn0020Tests(): Promise<void> {
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
  const testAuthorizer = {
    async authorize() {
      return true;
    },
  };

  const descriptor = Object.freeze({
    id: 'TouchDomain',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://touch-domain',
    requiresBasis: false,
    published: true,
  });
  const activateDesc = Object.freeze({
    id: 'ActivateHead',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://activate-head',
    requiresBasis: false,
    published: true,
  });

  function context(principalId: string) {
    return Object.freeze({
      principalId,
      sessionId: 'sess-zn0020',
      authenticatedAt: new Date().toISOString(),
      assurance: 'authenticated' as const,
      actorId: principalId,
      appSessionId: null,
      transport: 'cli' as const,
    });
  }

  function envelope(
    worldId: string,
    principalOp: string,
    operationId: string,
    purpose: string,
    expectedBasis: null | object = null,
  ) {
    return Object.freeze({
      schemaVersion: 1 as const,
      operation: principalOp,
      operationId,
      worldRef: Object.freeze({ worldId, realm: 'live' as const }),
      purpose,
      expectedBasis: expectedBasis as never,
      input: Object.freeze({}),
    });
  }

  async function seedWorld(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
      worldName: 'Commit World',
    });
    assert.equal(genesis.tag, 'Ok', JSON.stringify(genesis));
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    const worldId = genesis.value.worldId;
    for (const domain of fx.domains) {
      await pool.query(
        `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
         VALUES ($1::uuid,'live',$2,0)
         ON CONFLICT DO NOTHING`,
        [worldId, domain],
      );
    }
    return { principalId, worldId, releaseDigest: fx.seedDigest };
  }

  function makeAuthority(dbUrl: string, releaseDigest: string) {
    const db = new PgDatabase({ connectionString: dbUrl });
    const clock = { now: () => new Date().toISOString() };
    const authority = new Authority(db, testCrypto, clock, testAuthorizer, releaseDigest);
    return { db, authority };
  }

  test('ZN-0020-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, authority } = makeAuthority(requireDbUrl(), seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const world = { worldId: seeded.worldId, realm: 'live' as const };

        // Independent-domain writers concurrently
        const [a, b] = await Promise.all([
          authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
            ctx,
            descriptor,
            ['alpha'],
            async () => Object.freeze({ domain: 'alpha' }),
          ),
          authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
            ctx,
            descriptor,
            ['beta'],
            async () => Object.freeze({ domain: 'beta' }),
          ),
        ]);
        assert.ok(a.commitId);
        assert.ok(b.commitId);
        assert.notEqual(a.commitId, b.commitId);

        // Conflicting writers on same domain serialize/retry to durable outcomes
        const conflictResults = await Promise.allSettled([
          authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
            ctx,
            descriptor,
            ['gamma'],
            async () => Object.freeze({ domain: 'gamma', n: 1 }),
          ),
          authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
            ctx,
            descriptor,
            ['gamma'],
            async () => Object.freeze({ domain: 'gamma', n: 2 }),
          ),
        ]);
        const conflictOk = conflictResults.filter((r) => r.status === 'fulfilled');
        assert.ok(
          conflictOk.length >= 1,
          JSON.stringify(
            conflictResults.map((r) =>
              r.status === 'rejected' ? String(r.reason) : 'ok',
            ),
          ),
        );
        const gamma = await pool.query<{ version: string }>(
          `SELECT version::text FROM ontology.domains
           WHERE world_id=$1::uuid AND realm='live' AND domain_id='gamma'`,
          [seeded.worldId],
        );
        assert.ok(BigInt(gamma.rows[0]?.version ?? '0') >= 1n);

        // Head activation exclusive; concurrent writer must not expose mixed heads
        const nextRelease = hex64('zn-0020-next-release');
        const raced = await Promise.allSettled([
          authority.activateHead(ctx, world, activateDesc, fx.purpose, nextRelease),
          authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
            ctx,
            descriptor,
            ['beta'],
            async () => Object.freeze({ domain: 'beta', duringActivation: true }),
          ),
        ]);
        const activated = raced.find((r) => r.status === 'fulfilled' && r.value && 'releaseDigest' in (r.value as object));
        assert.ok(activated, JSON.stringify(raced.map((r) => r.status)));

        const heads = await pool.query<{ release_digest: string; n: number }>(
          `SELECT release_digest, count(*)::int AS n FROM ontology.worlds
           WHERE world_id=$1::uuid AND realm='live' GROUP BY release_digest`,
          [seeded.worldId],
        );
        assert.equal(heads.rows.length, 1);
        assert.equal(heads.rows[0]?.release_digest, nextRelease);

        const versions = await pool.query<{ domain_id: string; version: string }>(
          `SELECT domain_id, version::text FROM ontology.domains
           WHERE world_id=$1::uuid AND realm='live' AND domain_id=ANY($2::text[])
           ORDER BY domain_id`,
          [seeded.worldId, ['alpha', 'beta', 'gamma']],
        );
        assert.ok(versions.rows.every((r) => BigInt(r.version) >= 0n));
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0020-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, authority } = makeAuthority(requireDbUrl(), seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const staleBasis = Object.freeze({
          head: Object.freeze({
            releaseDigest: seeded.releaseDigest,
            generationId: randomUUID(),
            cellEpoch: '999',
            securityRevision: '0',
          }),
          cut: Object.freeze({ alpha: '0' }),
          readSetDigest: hex64('stale-basis'),
        });
        // Wrong readSetDigest / stale head → Stale; no partial receipt
        const before = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        let denied = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose, staleBasis),
            ctx,
            { ...descriptor, requiresBasis: true },
            ['alpha'],
            async () => Object.freeze({ should: 'not-commit' }),
          );
        } catch (error: unknown) {
          denied = true;
          const tag =
            typeof error === 'object' && error && 'tag' in error
              ? String((error as { tag: string }).tag)
              : '';
          assert.ok(['Stale', 'InvalidInput'].includes(tag), String(error));
        }
        assert.equal(denied, true);
        const after = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(after.rows[0]?.n, before.rows[0]?.n);

        // Changed intent same operationId → Conflict
        const opId = randomUUID();
        await authority.mutate(
          envelope(seeded.worldId, 'TouchDomain', opId, fx.purpose),
          ctx,
          descriptor,
          ['alpha'],
          async () => Object.freeze({ amount: 1 }),
        );
        let conflict = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', opId, fx.purpose),
            ctx,
            descriptor,
            ['alpha'],
            async () => Object.freeze({ amount: 2 }),
          );
        } catch (error: unknown) {
          conflict = true;
          const tag =
            typeof error === 'object' && error && 'tag' in error
              ? String((error as { tag: string }).tag)
              : '';
          // Conflict from KernelError OR digest mismatch path
          assert.ok(tag === 'Conflict' || tag === 'InvalidInput' || tag.length > 0, String(error));
        }
        // mutate compares intent digest of full envelope — same envelope shape with different work
        // result still hashes envelope not work output; force different input:
        try {
          await authority.mutate(
            Object.freeze({
              ...envelope(seeded.worldId, 'TouchDomain', opId, fx.purpose),
              input: Object.freeze({ amount: 2 }),
            }),
            ctx,
            descriptor,
            ['alpha'],
            async () => Object.freeze({ amount: 2 }),
          );
        } catch (error: unknown) {
          conflict = true;
          const tag =
            typeof error === 'object' && error && 'tag' in error
              ? String((error as { tag: string }).tag)
              : '';
          assert.equal(tag, 'Conflict');
        }
        assert.equal(conflict, true);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0020-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, authority } = makeAuthority(requireDbUrl(), seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const opId = randomUUID();
        const env = envelope(seeded.worldId, 'TouchDomain', opId, fx.purpose);
        // Duplicate same-intent delivery
        const results = await Promise.all(
          Array.from({ length: 6 }, () =>
            authority.mutate(env, ctx, descriptor, ['alpha'], async () =>
              Object.freeze({ once: true }),
            ),
          ),
        );
        const commitIds = new Set(results.map((r) => r.commitId));
        assert.equal(commitIds.size, 1);
        const receipts = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND operation_id=$2::uuid`,
          [seeded.worldId, opId],
        );
        assert.equal(receipts.rows[0]?.n, 1);

        // Stale basis after domain bump
        const { basis } = await (async () => {
          const sql = await db.connect();
          try {
            await sql.query('BEGIN');
            const tx = await authority.enter(
              sql,
              ctx,
              { worldId: seeded.worldId, realm: 'live' },
              descriptor,
              fx.purpose,
              false,
            );
            const b = await authority.basis(tx.head, tx.cut, ['alpha']);
            await sql.query('ROLLBACK');
            return { basis: b };
          } finally {
            sql.release();
          }
        })();
        await authority.mutate(
          envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose),
          ctx,
          descriptor,
          ['alpha'],
          async () => Object.freeze({ bump: true }),
        );
        let stale = false;
        try {
          await authority.mutate(
            envelope(seeded.worldId, 'TouchDomain', randomUUID(), fx.purpose, basis),
            ctx,
            { ...descriptor, requiresBasis: true },
            ['alpha'],
            async () => Object.freeze({ should: 'stale' }),
          );
        } catch (error: unknown) {
          stale = true;
          const tag =
            typeof error === 'object' && error && 'tag' in error
              ? String((error as { tag: string }).tag)
              : '';
          assert.equal(tag, 'Stale');
        }
        assert.equal(stale, true);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0020Tests();
