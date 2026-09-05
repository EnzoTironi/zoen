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
const FIXTURE_SEED = 'zn-0033-interpret-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/interpret.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/interpret.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0031_comparability.sql',
  'db/migrations/zn-0033_interpret.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0033-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/interpretation/interpret.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/families.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/comparability.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/types.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/ports.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/index.ts'),
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
  queryDigest: string;
  releaseDigest: string;
  cutDigest: string;
  perspective: string;
  amountLow: string;
  amountHigh: string;
  ruleDigest: string;
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

async function registerZn0033Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Interpreter } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/interpret.js'
  );
  const { PgDatabase } = await import('../../../.core-build/packages/adapters/src/pg.js');
  const { uuid } = await import('../../../.core-build/packages/kernel/src/ids.js');
  const { canonicalJson } = await import('../../../.core-build/packages/kernel/src/json.js');

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

  function basis(fx: Fixture, overrides: Partial<{ cutDigest: string; knowledgeVersion: number }> = {}) {
    return Object.freeze({
      releaseDigest: fx.releaseDigest,
      cutDigest: overrides.cutDigest ?? fx.cutDigest,
      knowledgeVersion: overrides.knowledgeVersion ?? 1,
      perspective: fx.perspective,
    });
  }

  test('ZN-0033-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const interpreter = new Interpreter(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const claimLow = uuid(randomUUID());
        const claimHigh = uuid(randomUUID());
        const candidates = Object.freeze([
          Object.freeze({
            claimId: claimLow,
            predicateId: 'order.quantity',
            subjectId,
            amount: fx.amountLow,
            unitOrCurrency: 'ea',
            authorized: true,
            arrivalOrdinal: 2,
            modelConfidence: 0.99,
            userConfidence: 0.1,
          }),
          Object.freeze({
            claimId: claimHigh,
            predicateId: 'order.quantity',
            subjectId,
            amount: fx.amountHigh,
            unitOrCurrency: 'ea',
            authorized: true,
            arrivalOrdinal: 1,
            modelConfidence: 0.01,
            userConfidence: 0.9,
          }),
        ]);

        const without = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates,
          basis: basis(fx),
        });
        assert.equal(without.tag, 'Ok');
        if (without.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(without.value.status, 'unresolved');
        assert.equal(without.value.contested, true);
        assert.equal(without.value.selectedRefs.length, 0);
        assert.equal(without.value.rivalRefs.length, 2);
        assert.equal(without.value.ruleDigest, null);

        const withRule = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates,
          basis: basis(fx),
          precedenceRule: Object.freeze({
            ruleId: 'revision-prefer-high',
            ruleDigest: fx.ruleDigest,
            preferredClaimId: claimHigh,
            resolvesContestation: false,
          }),
        });
        assert.equal(withRule.tag, 'Ok');
        if (withRule.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(withRule.value.status, 'selected');
        assert.deepEqual([...withRule.value.selectedRefs], [claimHigh]);
        assert.ok(withRule.value.rivalRefs.map(String).includes(String(claimLow)));
        assert.equal(withRule.value.contested, true);
        assert.equal(withRule.value.verification, 'rule-backed');
        assert.equal(withRule.value.ruleDigest, fx.ruleDigest);
        assert.equal(withRule.value.cutDigest, fx.cutDigest);

        // Reversed arrival must not change selection under the same rule
        const reversed = Object.freeze([candidates[1]!, candidates[0]!]);
        const again = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates: reversed,
          basis: basis(fx),
          precedenceRule: Object.freeze({
            ruleId: 'revision-prefer-high',
            ruleDigest: fx.ruleDigest,
            preferredClaimId: claimHigh,
            resolvesContestation: false,
          }),
        });
        assert.equal(again.tag, 'Ok');
        if (again.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(again.value.resultDigest, withRule.value.resultDigest);
        assert.equal(again.value.interpretationId, withRule.value.interpretationId);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0033-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const interpreter = new Interpreter(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const authId = uuid(randomUUID());
        const forbiddenId = uuid(randomUUID());
        const authorizedOnly = Object.freeze([
          Object.freeze({
            claimId: authId,
            predicateId: 'order.quantity',
            subjectId,
            amount: fx.amountLow,
            unitOrCurrency: 'ea',
            authorized: true,
          }),
        ]);
        const withForbidden = Object.freeze([
          ...authorizedOnly,
          Object.freeze({
            claimId: forbiddenId,
            predicateId: 'order.quantity',
            subjectId,
            amount: '999',
            unitOrCurrency: 'ea',
            authorized: false,
            modelConfidence: 1,
          }),
        ]);

        const base = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates: authorizedOnly,
          basis: basis(fx),
        });
        assert.equal(base.tag, 'Ok');
        if (base.tag !== 'Ok') throw new Error('expected Ok');

        const mixed = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates: withForbidden,
          basis: basis(fx),
        });
        assert.equal(mixed.tag, 'Ok');
        if (mixed.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(mixed.value.status, base.value.status);
        assert.deepEqual([...mixed.value.selectedRefs], [...base.value.selectedRefs]);
        assert.equal(JSON.stringify(mixed.value).includes(String(forbiddenId)), false);
        assert.equal(JSON.stringify(mixed.value).includes('999'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0033-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const interpreter = new Interpreter(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const candidates = Object.freeze([
          Object.freeze({
            claimId: uuid(randomUUID()),
            predicateId: 'order.quantity',
            subjectId,
            amount: fx.amountLow,
            unitOrCurrency: 'ea',
            authorized: true,
          }),
          Object.freeze({
            claimId: uuid(randomUUID()),
            predicateId: 'order.quantity',
            subjectId,
            amount: fx.amountHigh,
            unitOrCurrency: 'ea',
            authorized: true,
          }),
        ]);

        const raced = await Promise.all([
          interpreter.interpret({ world, queryDigest: fx.queryDigest, candidates, basis: basis(fx) }),
          interpreter.interpret({ world, queryDigest: fx.queryDigest, candidates, basis: basis(fx) }),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(raced[0]!.value.resultDigest, raced[1]!.value.resultDigest);
        assert.equal(raced[0]!.value.interpretationId, raced[1]!.value.interpretationId);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.value.firstRun).length, 1);

        const rows = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.interpretations WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(rows.rows[0]?.n, 1);

        const changedCut = '1111111111111111111111111111111111111111111111111111111111111111';
        const stale = await interpreter.interpret({
          world,
          queryDigest: fx.queryDigest,
          candidates,
          basis: basis(fx, { cutDigest: changedCut }),
        });
        assert.equal(stale.tag, 'Ok');
        if (stale.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(stale.value.firstRun, true);
        assert.notEqual(stale.value.interpretationId, raced[0]!.value.interpretationId);
        assert.equal(stale.value.cutDigest, changedCut);

        const rows2 = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.interpretations WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(rows2.rows[0]?.n, 2);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0033Tests();
