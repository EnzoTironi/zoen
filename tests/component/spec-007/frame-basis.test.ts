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
const FIXTURE_SEED = 'zn-0042-frame-basis-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-007/frame-basis.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-007/frame-basis.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0042_frame-basis.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0042-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/surfaces/frame-basis.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/types.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/ports.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/index.ts'),
        join(ROOT, 'packages/ontology/src/worlds/genesis.ts'),
        join(ROOT, 'packages/ontology/src/worlds/index.ts'),
        join(ROOT, 'packages/adapters/src/pg.ts'),
        join(ROOT, 'packages/contracts/src/ports.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
        join(ROOT, 'packages/kernel/src/decimal.ts'),
        join(ROOT, 'packages/kernel/src/time.ts'),
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
  domainId: string;
  rowLimit: number;
  preBody: string;
  postBody: string;
};

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

async function registerZn0042Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { FrameBasisService } = await import(
    '../../../.core-build/packages/ontology/src/surfaces/frame-basis.js'
  );
  const { PgDatabase } = await import('../../../.core-build/packages/adapters/src/pg.js');
  const { uuid } = await import('../../../.core-build/packages/kernel/src/ids.js');

  const testCrypto = {
    randomId: () => uuid(randomUUID()),
    randomReference: () => randomUUID().replace(/-/g, ''),
    async sha256(bytes: Uint8Array) {
      return createHash('sha256').update(bytes).digest('hex');
    },
    async digest(value: unknown) {
      return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
    },
  };

  async function seedWorld(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    return { principalId, worldId: genesis.value.worldId as string };
  }

  test('ZN-0042-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const frames = new FrameBasisService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const principalId = uuid(seeded.principalId);
        await frames.seedSparseRow({
          world,
          rowId: uuid(randomUUID()),
          domainId: fx.domainId,
          ordinal: 1,
          body: fx.preBody,
          opaqueRef: 'ref-pre',
        });

        let ingestionStarted = false;
        let ingestionDone = false;
        const acquired = await frames.acquire({
          world,
          operationId: uuid(randomUUID()),
          principalId,
          purpose: fx.purpose,
          perspective: 'owner',
          domainId: fx.domainId,
          rowLimit: fx.rowLimit,
          whileSnapshotOpen: async () => {
            ingestionStarted = true;
            await frames.ingestSparse({
              world,
              domainId: fx.domainId,
              rowId: uuid(randomUUID()),
              ordinal: 2,
              body: fx.postBody,
              opaqueRef: 'ref-post',
            });
            ingestionDone = true;
          },
        });
        assert.equal(ingestionStarted, true);
        assert.equal(ingestionDone, true);
        assert.equal(acquired.tag, 'Ok');
        if (acquired.tag !== 'Ok') throw new Error('acquire');

        // Coherent snapshot: either all-pre or (if RR saw post after conflict retry) all-post —
        // never mixed pre body with post domain version alone.
        const bodies = acquired.value.sparseRows.map((r) => r.body);
        const hasPre = bodies.includes(fx.preBody);
        const hasPost = bodies.includes(fx.postBody);
        assert.equal(hasPre && hasPost, false, 'mixed pre/post sparse rows');
        // In REPEATABLE READ, concurrent insert after first read may be invisible → pre-only.
        // That is coherent. If serialization forced retry after ingest, post may appear with matching cut.
        if (hasPre) {
          assert.equal(hasPost, false);
          assert.ok(acquired.value.sparseRows.every((r) => r.body === fx.preBody));
        }
        if (hasPost) {
          assert.ok(acquired.value.cut[fx.domainId]);
        }
        assert.ok(acquired.value.pins.length >= 2);
        assert.ok(acquired.value.planDigest.length === 64);
        assert.ok(acquired.value.headDigest.length === 64);
        assert.equal(acquired.value.incomplete, false);

        // Outside snapshot, both rows exist in DB — proves ingestion happened
        const all = await pool.query<{ body: string }>(
          `SELECT body FROM ontology.frame_sparse_rows WHERE world_id=$1::uuid ORDER BY ordinal`,
          [seeded.worldId],
        );
        assert.ok(all.rows.some((r) => r.body === fx.preBody));
        assert.ok(all.rows.some((r) => r.body === fx.postBody));
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0042-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const frames = new FrameBasisService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        await frames.seedSparseRow({
          world,
          rowId: uuid(randomUUID()),
          domainId: fx.domainId,
          ordinal: 1,
          body: fx.preBody,
          opaqueRef: 'secret-ref',
        });

        // No membership / wrong principal — opaque resolve collapses to NOT_FOUND_OR_DENIED
        const stranger = await frames.resolveOpaqueRef({
          world,
          principalId: uuid(randomUUID()),
          opaqueRef: 'secret-ref',
        });
        assert.equal(stranger.tag, 'Denied');
        if (stranger.tag === 'Denied') assert.equal(stranger.reason, 'NOT_FOUND_OR_DENIED');
        assert.equal(JSON.stringify(stranger).includes(fx.preBody), false);
        assert.equal(JSON.stringify(stranger).includes('row_id'), false);
        assert.equal(JSON.stringify(stranger).includes('count'), false);

        // Missing ref — same denial shape (no existence leak)
        const missing = await frames.resolveOpaqueRef({
          world,
          principalId: uuid(seeded.principalId),
          opaqueRef: 'does-not-exist',
        });
        assert.equal(missing.tag, 'Denied');
        if (missing.tag === 'Denied') assert.equal(missing.reason, 'NOT_FOUND_OR_DENIED');
        assert.deepEqual(Object.keys(stranger).sort(), Object.keys(missing).sort());
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0042-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const frames = new FrameBasisService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const principalId = uuid(seeded.principalId);
        for (let i = 0; i < 5; i++) {
          await frames.seedSparseRow({
            world,
            rowId: uuid(randomUUID()),
            domainId: fx.domainId,
            ordinal: i,
            body: `row-${i}`,
            opaqueRef: `ref-${i}`,
          });
        }

        const operationId = uuid(randomUUID());
        const payload = {
          world,
          operationId,
          principalId,
          purpose: fx.purpose,
          perspective: 'owner',
          domainId: fx.domainId,
          rowLimit: 2,
        } as const;

        const raced = await Promise.all([frames.acquire(payload), frames.acquire(payload)]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('race');
        assert.equal(raced[0]!.value.frameId, raced[1]!.value.frameId);
        assert.equal(raced[0]!.value.resultDigest, raced[1]!.value.resultDigest);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.value.firstRun).length, 1);

        // Limit overflow → incomplete, not silent complete truncation
        assert.equal(raced[0]!.value.incomplete, true);
        assert.equal(raced[0]!.value.sparseRows.length, 2);

        const unsupported = await frames.acquire({
          ...payload,
          operationId: uuid(randomUUID()),
          rowLimit: 9999,
        });
        assert.equal(unsupported.tag, 'Denied');
        if (unsupported.tag === 'Denied') assert.equal(unsupported.reason, 'UNSUPPORTED_LIMIT');

        // Revoked access
        await pool.query(
          `UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [seeded.worldId, seeded.principalId],
        );
        const revoked = await frames.acquire({
          ...payload,
          operationId: uuid(randomUUID()),
        });
        assert.equal(revoked.tag, 'Denied');
        if (revoked.tag === 'Denied') assert.equal(revoked.reason, 'NOT_FOUND_OR_DENIED');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0042Tests();
