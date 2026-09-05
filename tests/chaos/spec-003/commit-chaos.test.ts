import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0024-commit-chaos-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-003/commit-chaos.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-003/commit-chaos.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

/** Named advisory keys for honest in-transaction barriers (real PG waits). */
const BARRIERS = Object.freeze({
  before_outbox: 902401n,
  after_outbox_before_commit: 902402n,
  before_domain_write: 902403n,
} as const);

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0024-emit-${process.pid}`);
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
        join(ROOT, 'packages/kernel/src/json.js'.replace(/\.js$/, '.ts')),
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
  domainA: string;
  domainB: string;
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

async function installBarrierTriggers(pool: pg.Pool, active: keyof typeof BARRIERS | null): Promise<void> {
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.zoen_chaos_wait(k bigint) RETURNS void AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(k);
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS zoen_chaos_before_domain ON ontology.domains;
    DROP TRIGGER IF EXISTS zoen_chaos_before_outbox ON jobs.outbox;
    DROP TRIGGER IF EXISTS zoen_chaos_after_outbox ON jobs.outbox;
  `);
  if (active === 'before_domain_write') {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.zoen_chaos_before_domain() RETURNS trigger AS $$
      BEGIN
        PERFORM public.zoen_chaos_wait(${BARRIERS.before_domain_write});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER zoen_chaos_before_domain
        BEFORE UPDATE ON ontology.domains
        FOR EACH ROW EXECUTE FUNCTION public.zoen_chaos_before_domain();
    `);
  } else if (active === 'before_outbox') {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.zoen_chaos_before_outbox() RETURNS trigger AS $$
      BEGIN
        PERFORM public.zoen_chaos_wait(${BARRIERS.before_outbox});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER zoen_chaos_before_outbox
        BEFORE INSERT ON jobs.outbox
        FOR EACH ROW EXECUTE FUNCTION public.zoen_chaos_before_outbox();
    `);
  } else if (active === 'after_outbox_before_commit') {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.zoen_chaos_after_outbox() RETURNS trigger AS $$
      BEGIN
        PERFORM public.zoen_chaos_wait(${BARRIERS.after_outbox_before_commit});
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER zoen_chaos_after_outbox
        AFTER INSERT ON jobs.outbox
        FOR EACH ROW EXECUTE FUNCTION public.zoen_chaos_after_outbox();
    `);
  }
}

async function dropBarrierTriggers(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DROP TRIGGER IF EXISTS zoen_chaos_before_domain ON ontology.domains;
    DROP TRIGGER IF EXISTS zoen_chaos_before_outbox ON jobs.outbox;
    DROP TRIGGER IF EXISTS zoen_chaos_after_outbox ON jobs.outbox;
    DROP FUNCTION IF EXISTS public.zoen_chaos_before_domain();
    DROP FUNCTION IF EXISTS public.zoen_chaos_before_outbox();
    DROP FUNCTION IF EXISTS public.zoen_chaos_after_outbox();
  `);
}

type AuthorityCounts = {
  operations: number;
  commits: number;
  receipts: number;
  outbox: number;
};

async function countAuthority(pool: pg.Pool, worldId: string, semanticOp: string): Promise<AuthorityCounts> {
  const ops = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ontology.operations WHERE world_id=$1::uuid AND semantic_op=$2`,
    [worldId, semanticOp],
  );
  const commits = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ontology.commits WHERE world_id=$1::uuid`,
    [worldId],
  );
  const receipts = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ontology.receipts WHERE world_id=$1::uuid`,
    [worldId],
  );
  const outbox = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM jobs.outbox WHERE world_id=$1::uuid`,
    [worldId],
  );
  return {
    operations: ops.rows[0]?.n ?? 0,
    commits: commits.rows[0]?.n ?? 0,
    receipts: receipts.rows[0]?.n ?? 0,
    outbox: outbox.rows[0]?.n ?? 0,
  };
}

function assertAtomicOrAbsent(c: AuthorityCounts, genesisBaseline: AuthorityCounts): void {
  const dOps = c.operations - genesisBaseline.operations;
  const dCommits = c.commits - genesisBaseline.commits;
  const dReceipts = c.receipts - genesisBaseline.receipts;
  const dOutbox = c.outbox - genesisBaseline.outbox;
  const allZero = dOps === 0 && dCommits === 0 && dReceipts === 0 && dOutbox === 0;
  const allOne = dOps === 1 && dCommits === 1 && dReceipts === 1 && dOutbox === 1;
  assert.ok(
    allZero || allOne,
    `partial authority state: Δops=${dOps} Δcommits=${dCommits} Δreceipts=${dReceipts} Δoutbox=${dOutbox}`,
  );
}

function writeChildRunner(path: string): void {
  writeFileSync(
    path,
    `import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
const u = (p) => pathToFileURL(p).href;
const { createPersonalWorld } = await import(u(${JSON.stringify(join(OUT, 'packages/ontology/src/worlds/genesis.js'))}));
const { Authority } = await import(u(${JSON.stringify(join(OUT, 'packages/ontology/src/authority/transaction.js'))}));
const { PgDatabase } = await import(u(${JSON.stringify(join(OUT, 'packages/adapters/src/pg.js'))}));
const { canonicalJson } = await import(u(${JSON.stringify(join(OUT, 'packages/kernel/src/json.js'))}));
const { uuid } = await import(u(${JSON.stringify(join(OUT, 'packages/kernel/src/ids.js'))}));

const payload = JSON.parse(process.argv[2]);
const dbUrl = process.env.ZOEN_TEST_DATABASE_URL;
if (!dbUrl) { console.error('MissingPrerequisite'); process.exit(2); }

const testCrypto = {
  randomId: () => uuid(randomUUID()),
  randomReference: () => randomUUID().replace(/-/g, ''),
  async sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); },
  async digest(value) { return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); },
};
const authorizer = { async authorize() { return true; } };
const descriptor = Object.freeze({
  id: payload.operation,
  kind: 'mutation',
  scope: 'world',
  inputSchemaId: 'zoen://chaos',
  requiresBasis: false,
  published: true,
});
const ctx = Object.freeze({
  principalId: payload.principalId,
  sessionId: 'chaos-child',
  authenticatedAt: new Date().toISOString(),
  assurance: 'authenticated',
  actorId: payload.principalId,
  appSessionId: null,
  transport: 'cli',
});
const envelope = Object.freeze({
  schemaVersion: 1,
  operation: payload.operation,
  operationId: payload.operationId,
  worldRef: Object.freeze({ worldId: payload.worldId, realm: 'live' }),
  purpose: payload.purpose,
  expectedBasis: null,
  input: Object.freeze({}),
});

const db = new PgDatabase({ connectionString: dbUrl });
const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, payload.releaseDigest);
try {
  const result = await authority.mutate(
    envelope,
    ctx,
    descriptor,
    payload.domains,
    async () => Object.freeze({ chaos: true, domains: payload.domains }),
  );
  process.stdout.write(JSON.stringify({ tag: 'Ok', commitId: result.commitId, receiptId: result.receiptId }) + '\\n');
} catch (error) {
  const tag = error && typeof error === 'object' && 'tag' in error ? error.tag : 'Error';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : String(error);
  process.stdout.write(JSON.stringify({ tag, code }) + '\\n');
  process.exitCode = 1;
} finally {
  await db.close();
}
`,
  );
}

async function waitUntilBlocked(pool: pg.Pool, lockKey: bigint, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Waiting backends stay state=active with wait_event_type=Lock; do not require state~wait.
    const adv = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
       FROM pg_locks
       WHERE locktype = 'advisory' AND objid = $1::bigint AND NOT granted`,
      [lockKey.toString()],
    );
    if ((adv.rows[0]?.n ?? 0) > 0) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function registerZn0024Tests(): Promise<void> {
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
    id: 'ChaosCommit',
    kind: 'mutation' as const,
    scope: 'world' as const,
    inputSchemaId: 'zoen://chaos-commit',
    requiresBasis: false,
    published: true,
  });

  function context(principalId: string) {
    return Object.freeze({
      principalId,
      sessionId: 'sess-zn0024',
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
      operation: 'ChaosCommit',
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
    for (const domain of [fx.domainA, fx.domainB]) {
      await pool.query(
        `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
         VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`,
        [genesis.value.worldId, domain],
      );
    }
    return { principalId, worldId: genesis.value.worldId, releaseDigest: fx.seedDigest };
  }

  test('ZN-0024-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const childPath = join(OUT, `zn-0024-child-${process.pid}.mjs`);
    writeChildRunner(childPath);

    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const baseline = await countAuthority(pool, seeded.worldId, 'ChaosCommit');

      const barrierNames = Object.keys(BARRIERS) as (keyof typeof BARRIERS)[];
      for (const barrier of barrierNames) {
        await installBarrierTriggers(pool, barrier);
        const lockKey = BARRIERS[barrier];

        // Parent holds the advisory lock so the child blocks inside the open transaction.
        const holder = await pool.connect();
        await holder.query('SELECT pg_advisory_lock($1::bigint)', [lockKey.toString()]);

        const operationId = randomUUID();
        const child: ChildProcess = spawn(
          process.execPath,
          [
            '--experimental-strip-types',
            childPath,
            JSON.stringify({
              principalId: seeded.principalId,
              worldId: seeded.worldId,
              releaseDigest: seeded.releaseDigest,
              purpose: fx.purpose,
              operation: 'ChaosCommit',
              operationId,
              domains: [fx.domainA, fx.domainB],
            }),
          ],
          {
            cwd: ROOT,
            env: { ...process.env, ZOEN_TEST_DATABASE_URL: requireDbUrl() },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        assert.ok(child.pid, 'MissingPrerequisite: child pid for SIGKILL');
        let childErr = '';
        let childOut = '';
        child.stderr?.on('data', (d) => { childErr += String(d); });
        child.stdout?.on('data', (d) => { childOut += String(d); });

        const blocked = await waitUntilBlocked(pool, lockKey);
        if (!blocked) {
          try { process.kill(child.pid!, 'SIGKILL'); } catch { /* ignore */ }
          throw new Error(
            `MissingPrerequisite: child never blocked at barrier=${barrier}. stderr=${childErr} stdout=${childOut}`,
          );
        }

        // REAL process termination — not a mocked failure.
        process.kill(child.pid!, 'SIGKILL');
        await new Promise<void>((resolveExit) => {
          child.on('exit', () => resolveExit());
          setTimeout(resolveExit, 2000);
        });

        await holder.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey.toString()]);
        holder.release();

        // After kill at in-transaction barrier: must observe no partial semantic set.
        const afterKill = await countAuthority(pool, seeded.worldId, 'ChaosCommit');
        assertAtomicOrAbsent(afterKill, baseline);
        assert.equal(afterKill.operations, baseline.operations, `barrier=${barrier} leaked operation after SIGKILL`);

        await dropBarrierTriggers(pool);

        // Retry same operation ID without barriers — complete set exactly once.
        const db = new PgDatabase({ connectionString: requireDbUrl() });
        const authority = new Authority(
          db,
          testCrypto,
          { now: () => new Date().toISOString() },
          testAuthorizer,
          seeded.releaseDigest,
        );
        try {
          const result = await authority.mutate(
            envelope(seeded.worldId, operationId, fx.purpose),
            context(seeded.principalId),
            descriptor,
            [fx.domainA, fx.domainB],
            async () => Object.freeze({ chaos: true, recovered: barrier }),
          );
          assert.ok(result.commitId);

          // Same intent replay
          const replay = await authority.mutate(
            envelope(seeded.worldId, operationId, fx.purpose),
            context(seeded.principalId),
            descriptor,
            [fx.domainA, fx.domainB],
            async () => Object.freeze({ chaos: true, shouldNotRun: true }),
          );
          assert.equal(replay.commitId, result.commitId);
        } finally {
          await db.close();
        }

        const finalCounts = await countAuthority(pool, seeded.worldId, 'ChaosCommit');
        // Exactly one ChaosCommit semantic result across all barrier iterations accumulates.
        assert.ok(finalCounts.operations >= baseline.operations + 1);
        // For this operationId specifically:
        const opRows = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND operation_id=$2::uuid`,
          [seeded.worldId, operationId],
        );
        assert.equal(opRows.rows[0]?.n, 1);

        const linked = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n
           FROM ontology.operations o
           JOIN ontology.commits c ON c.world_id=o.world_id AND c.realm=o.realm AND c.commit_id=o.commit_id
           JOIN ontology.receipts r ON r.world_id=o.world_id AND r.realm=o.realm AND r.receipt_id=o.result_ref
           JOIN jobs.outbox x ON x.world_id=o.world_id AND x.realm=o.realm AND x.commit_id=o.commit_id
           WHERE o.world_id=$1::uuid AND o.operation_id=$2::uuid`,
          [seeded.worldId, operationId],
        );
        assert.equal(linked.rows[0]?.n, 1, `incomplete receipt/domain/outbox set for ${barrier}`);

        // refresh baseline for next barrier iteration (committed work stays)
        Object.assign(baseline, await countAuthority(pool, seeded.worldId, 'ChaosCommit'));
      }
    } finally {
      try { unlinkSync(childPath); } catch { /* ignore */ }
      await dropBarrierTriggers(pool).catch(() => undefined);
      await pool.end();
    }
  });

  test('ZN-0024-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(
        db,
        testCrypto,
        { now: () => new Date().toISOString() },
        testAuthorizer,
        seeded.releaseDigest,
      );
      try {
        const opId = randomUUID();
        const first = await authority.mutate(
          envelope(seeded.worldId, opId, fx.purpose),
          context(seeded.principalId),
          descriptor,
          [fx.domainA, fx.domainB],
          async () => Object.freeze({ v: 1 }),
        );
        assert.ok(first.commitId);

        // Changed intent under same operation ID → Conflict; no second receipt
        const before = await countAuthority(pool, seeded.worldId, 'ChaosCommit');
        let conflict = false;
        try {
          await authority.mutate(
            Object.freeze({
              ...envelope(seeded.worldId, opId, fx.purpose),
              input: Object.freeze({ altered: true }),
            }),
            context(seeded.principalId),
            descriptor,
            [fx.domainA, fx.domainB],
            async () => Object.freeze({ v: 2 }),
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
        const after = await countAuthority(pool, seeded.worldId, 'ChaosCommit');
        assert.equal(after.operations, before.operations);
        assert.equal(after.receipts, before.receipts);
        assert.equal(after.outbox, before.outbox);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0024-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const childPath = join(OUT, `zn-0024-boundary-${process.pid}.mjs`);
    writeChildRunner(childPath);
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const baseline = await countAuthority(pool, seeded.worldId, 'ChaosCommit');

      // Kill after outbox insert (still before COMMIT) then concurrent retry race.
      await installBarrierTriggers(pool, 'after_outbox_before_commit');
      const lockKey = BARRIERS.after_outbox_before_commit;
      const holder = await pool.connect();
      await holder.query('SELECT pg_advisory_lock($1::bigint)', [lockKey.toString()]);

      const operationId = randomUUID();
      const child = spawn(
        process.execPath,
        [
          '--experimental-strip-types',
          childPath,
          JSON.stringify({
            principalId: seeded.principalId,
            worldId: seeded.worldId,
            releaseDigest: seeded.releaseDigest,
            purpose: fx.purpose,
            operation: 'ChaosCommit',
            operationId,
            domains: [fx.domainA, fx.domainB],
          }),
        ],
        {
          cwd: ROOT,
          env: { ...process.env, ZOEN_TEST_DATABASE_URL: requireDbUrl() },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      assert.ok(child.pid);
      const blocked = await waitUntilBlocked(pool, lockKey);
      assert.equal(blocked, true, 'MissingPrerequisite: boundary barrier not reached');
      process.kill(child.pid!, 'SIGKILL');
      await new Promise<void>((r) => { child.on('exit', () => r()); setTimeout(r, 2000); });
      await holder.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey.toString()]);
      holder.release();
      await dropBarrierTriggers(pool);

      assertAtomicOrAbsent(await countAuthority(pool, seeded.worldId, 'ChaosCommit'), baseline);

      // Concurrent same-intent retries after kill — at most one semantic result.
      const db1 = new PgDatabase({ connectionString: requireDbUrl() });
      const db2 = new PgDatabase({ connectionString: requireDbUrl() });
      const a1 = new Authority(db1, testCrypto, { now: () => new Date().toISOString() }, testAuthorizer, seeded.releaseDigest);
      const a2 = new Authority(db2, testCrypto, { now: () => new Date().toISOString() }, testAuthorizer, seeded.releaseDigest);
      try {
        const results = await Promise.allSettled([
          a1.mutate(
            envelope(seeded.worldId, operationId, fx.purpose),
            context(seeded.principalId),
            descriptor,
            [fx.domainA, fx.domainB],
            async () => Object.freeze({ race: 1 }),
          ),
          a2.mutate(
            envelope(seeded.worldId, operationId, fx.purpose),
            context(seeded.principalId),
            descriptor,
            [fx.domainA, fx.domainB],
            async () => Object.freeze({ race: 2 }),
          ),
        ]);
        const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ commitId: string }>[];
        assert.ok(ok.length >= 1);
        const commits = new Set(ok.map((r) => r.value.commitId));
        assert.equal(commits.size, 1);
        const ops = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.operations
           WHERE world_id=$1::uuid AND operation_id=$2::uuid`,
          [seeded.worldId, operationId],
        );
        assert.equal(ops.rows[0]?.n, 1);
      } finally {
        await db1.close();
        await db2.close();
      }
    } finally {
      try { unlinkSync(childPath); } catch { /* ignore */ }
      await dropBarrierTriggers(pool).catch(() => undefined);
      await pool.end();
    }
  });
}

await registerZn0024Tests();
