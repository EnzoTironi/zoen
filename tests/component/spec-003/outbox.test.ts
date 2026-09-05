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
const FIXTURE_SEED = 'zn-0023-outbox-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/outbox.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/outbox.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0023-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/authority/outbox.ts'),
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
  domain: string;
  streamOwner: string;
  consumer: string;
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

async function registerZn0023Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Authority } = await import(
    '../../../.core-build/packages/ontology/src/authority/transaction.js'
  );
  const { OutboxQueue } = await import(
    '../../../.core-build/packages/ontology/src/authority/outbox.js'
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
    id: 'RecordNote',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://record-note',
    requiresBasis: false,
    published: true,
  });

  function context(principalId: string) {
    return Object.freeze({
      principalId,
      sessionId: 'sess-zn0023',
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
      operation: 'RecordNote',
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
    const outbox = new OutboxQueue(db);
    return { db, authority, outbox };
  }

  test('ZN-0023-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority, outbox } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const committed = await authority.mutate(
          envelope(seeded.worldId, randomUUID(), fx.purpose),
          ctx,
          descriptor,
          [fx.domain],
          async () => Object.freeze({ note: 'handoff-v1' }),
        );

        const workerA = uuid(randomUUID());
        const workerB = uuid(randomUUID());
        const claimedA = await outbox.claim(workerA, fx.streamOwner, 10, 60);
        assert.ok(claimedA.length >= 1);
        const leaseA = claimedA.find((l) => l.commitId === committed.commitId);
        assert.ok(leaseA, 'expected lease for mutate commit');

        // Worker dies after consumer admission but before outbox acknowledgement
        const admit1 = await outbox.admitConsumer(leaseA, fx.consumer);
        assert.equal(admit1.firstAdmission, true);

        // Force lease expiry so successor can take over
        await pool.query(
          `UPDATE jobs.outbox SET lease_until = clock_timestamp() - interval '1 second'
           WHERE outbox_id = $1::uuid`,
          [leaseA.outboxId],
        );

        const claimedB = await outbox.claim(workerB, fx.streamOwner, 10, 60);
        assert.equal(claimedB.length, 1);
        const leaseB = claimedB[0]!;
        assert.equal(leaseB.outboxId, leaseA.outboxId);
        assert.notEqual(leaseB.fence, leaseA.fence);

        // Successor retries same event — consumer has one admitted event
        const admit2 = await outbox.admitConsumer(leaseB, fx.consumer);
        assert.equal(admit2.firstAdmission, false);
        assert.equal(admit2.eventKey, admit1.eventKey);

        const admissions = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.consumer_admissions
           WHERE consumer = $1 AND outbox_id = $2::uuid`,
          [fx.consumer, leaseA.outboxId],
        );
        assert.equal(admissions.rows[0]?.n, 1);

        // Successor can finish
        const progress = await outbox.progressCommit(leaseB, `cursor:${leaseB.outboxId}`);
        assert.equal(progress.worker, workerB);
        await outbox.acknowledge(leaseB);

        const delivered = await pool.query<{ state: string }>(
          `SELECT state FROM jobs.outbox WHERE outbox_id = $1::uuid`,
          [leaseA.outboxId],
        );
        assert.equal(delivered.rows[0]?.state, 'delivered');

        // Old fence cannot mark progress or settle work
        let lostProgress = false;
        try {
          await outbox.progressCommit(leaseA, 'zombie-cursor');
        } catch (error: unknown) {
          lostProgress = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'LostLease',
          );
        }
        assert.equal(lostProgress, true);

        let lostAck = false;
        try {
          await outbox.acknowledge(leaseA);
        } catch (error: unknown) {
          lostAck = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'LostLease',
          );
        }
        assert.equal(lostAck, true);

        // Cursor remains successor's, not zombie
        const cursors = await pool.query<{ cursor: string; worker: string }>(
          `SELECT cursor, worker::text FROM jobs.consumer_cursors WHERE stream_owner = $1`,
          [fx.streamOwner],
        );
        assert.equal(cursors.rows[0]?.worker, workerB);
        assert.equal(cursors.rows[0]?.cursor, `cursor:${leaseB.outboxId}`);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0023-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority, outbox } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        await authority.mutate(
          envelope(seeded.worldId, randomUUID(), fx.purpose),
          ctx,
          descriptor,
          [fx.domain],
          async () => Object.freeze({ note: 'neg' }),
        );
        const worker = uuid(randomUUID());
        const [lease] = await outbox.claim(worker, fx.streamOwner, 5, 30);
        assert.ok(lease);

        // Stale fence: bump fence underneath the worker
        await pool.query(
          `UPDATE jobs.outbox SET fence = fence + 1, lease_owner = $2::uuid
           WHERE outbox_id = $1::uuid`,
          [lease.outboxId, randomUUID()],
        );

        const beforeAdmissions = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.consumer_admissions`,
        );
        const beforeDelivered = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.outbox WHERE state = 'delivered'`,
        );

        let denied = false;
        try {
          await outbox.admitConsumer(lease, fx.consumer);
        } catch (error: unknown) {
          denied = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'LostLease',
          );
        }
        assert.equal(denied, true);

        const afterAdmissions = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.consumer_admissions`,
        );
        const afterDelivered = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.outbox WHERE state = 'delivered'`,
        );
        assert.equal(afterAdmissions.rows[0]?.n, beforeAdmissions.rows[0]?.n);
        assert.equal(afterDelivered.rows[0]?.n, beforeDelivered.rows[0]?.n);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0023-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const { db, authority, outbox } = makeAuthority(seeded.releaseDigest);
      try {
        const ctx = context(seeded.principalId);
        const committed = await authority.mutate(
          envelope(seeded.worldId, randomUUID(), fx.purpose),
          ctx,
          descriptor,
          [fx.domain],
          async () => Object.freeze({ note: 'boundary' }),
        );

        // Owner-specific cursors stay separate
        const otherOwner = 'effects';
        await pool.query(
          `INSERT INTO jobs.outbox(world_id,realm,outbox_id,owner,commit_id,event_ordinal,payload_ref)
           SELECT world_id, realm, gen_random_uuid(), $2, commit_id, 1, payload_ref
           FROM jobs.outbox WHERE commit_id = $1::uuid`,
          [committed.commitId, otherOwner],
        );

        const worker = uuid(randomUUID());
        const aAll = await outbox.claim(worker, fx.streamOwner, 10, 30);
        const bAll = await outbox.claim(worker, otherOwner, 10, 30);
        const aLease = aAll.find((l) => l.commitId === committed.commitId);
        const bLease = bAll.find((l) => l.commitId === committed.commitId);
        assert.ok(aLease);
        assert.ok(bLease);
        assert.notEqual(aLease.outboxId, bLease.outboxId);
        assert.equal(aLease.streamOwner, fx.streamOwner);
        assert.equal(bLease.streamOwner, otherOwner);

        await outbox.admitConsumer(aLease, fx.consumer);
        await outbox.progressCommit(aLease, 'auth-cursor');
        await outbox.admitConsumer(bLease, 'effect-consumer');
        await outbox.progressCommit(bLease, 'effect-cursor');

        const cursors = await pool.query<{ stream_owner: string; cursor: string }>(
          `SELECT stream_owner, cursor FROM jobs.consumer_cursors ORDER BY stream_owner`,
        );
        assert.equal(cursors.rows.length, 2);
        assert.equal(cursors.rows.find((r) => r.stream_owner === fx.streamOwner)?.cursor, 'auth-cursor');
        assert.equal(cursors.rows.find((r) => r.stream_owner === otherOwner)?.cursor, 'effect-cursor');

        // Race: duplicate claim after expiry — at most one delivered ack wins
        await pool.query(
          `UPDATE jobs.outbox SET lease_until = clock_timestamp() - interval '1 second'
           WHERE outbox_id = $1::uuid`,
          [aLease.outboxId],
        );
        const w1 = uuid(randomUUID());
        const w2 = uuid(randomUUID());
        const [c1, c2] = await Promise.all([
          outbox.claim(w1, fx.streamOwner, 5, 30),
          outbox.claim(w2, fx.streamOwner, 5, 30),
        ]);
        const winners = [...c1, ...c2].filter((l) => l.outboxId === aLease.outboxId);
        assert.equal(winners.length, 1);

        await outbox.acknowledge(winners[0]!);
        const states = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.outbox
           WHERE outbox_id = $1::uuid AND state = 'delivered'`,
          [aLease.outboxId],
        );
        assert.equal(states.rows[0]?.n, 1);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0023Tests();
