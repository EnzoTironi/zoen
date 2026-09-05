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
const FIXTURE_SEED = 'zn-0036-laws-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/interpretation-laws.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/interpretation-laws.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0031_comparability.sql',
  'db/migrations/zn-0033_interpret.sql',
  'db/migrations/zn-0034_correction.sql',
  'db/migrations/zn-0035_impact.sql',
  'db/migrations/zn-0036_interpretation-laws.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0036-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/interpretation/interpretation-laws.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/impact.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/correction.ts'),
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
  priorCutDigest: string;
  perspective: string;
  amountAuthorized: string;
  amountRivalHidden: string;
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

async function registerZn0036Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { InterpretationLaws } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/interpretation-laws.js'
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

  test('ZN-0036-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const laws = new InterpretationLaws(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const authClaim = uuid(randomUUID());
        const hiddenClaim = uuid(randomUUID());
        const basis = Object.freeze({
          releaseDigest: fx.releaseDigest,
          cutDigest: fx.cutDigest,
          knowledgeVersion: 1,
          perspective: fx.perspective,
        });
        const authorizedCandidates = Object.freeze([
          Object.freeze({
            claimId: authClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountAuthorized,
            unitOrCurrency: 'EA',
            authorized: true,
          }),
        ]);
        const withHidden = Object.freeze([
          ...authorizedCandidates,
          Object.freeze({
            claimId: hiddenClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountRivalHidden,
            unitOrCurrency: 'EA',
            authorized: false,
          }),
        ]);

        const proof = await laws.proveVisibleEquivalence({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          basis,
          authorizedCandidates,
          withHiddenRivalCandidates: withHidden,
        });
        assert.equal(proof.tag, 'Ok');
        if (proof.tag !== 'Ok') throw new Error('proof');
        assert.equal(proof.value.equivalent, true);
        assert.equal(proof.value.declassified, false);
        assert.equal(proof.value.leakDetected, false);
        assert.equal(proof.value.observableDigestA, proof.value.observableDigestB);
        assert.equal(proof.value.projectionA.status, 'selected');
        assert.equal(proof.value.projectionB?.status, 'selected');
        assert.ok(proof.value.hiddenRivalIds.includes(String(hiddenClaim)));
        assert.equal(JSON.stringify(proof.value.projectionA).includes(fx.amountRivalHidden), false);
        assert.equal(JSON.stringify(proof.value.projectionB).includes(fx.amountRivalHidden), false);
        assert.equal(JSON.stringify(proof.value.projectionB).includes(String(hiddenClaim)), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0036-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const laws = new InterpretationLaws(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const authClaim = uuid(randomUUID());
        const hiddenClaim = uuid(randomUUID());
        const basis = Object.freeze({
          releaseDigest: fx.releaseDigest,
          cutDigest: fx.cutDigest,
          knowledgeVersion: 1,
          perspective: fx.perspective,
        });
        const authorizedCandidates = Object.freeze([
          Object.freeze({
            claimId: authClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountAuthorized,
            unitOrCurrency: 'EA',
            authorized: true,
          }),
        ]);
        const withHidden = Object.freeze([
          ...authorizedCandidates,
          Object.freeze({
            claimId: hiddenClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountRivalHidden,
            unitOrCurrency: 'EA',
            authorized: false,
          }),
        ]);

        const ok = await laws.proveVisibleEquivalence({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          basis,
          authorizedCandidates,
          withHiddenRivalCandidates: withHidden,
        });
        assert.equal(ok.tag, 'Ok');
        if (ok.tag !== 'Ok') throw new Error('ok');
        // Forbidden rival must not leak into authorized wording/counts
        const blob = JSON.stringify(ok.value);
        assert.equal(blob.includes(fx.amountRivalHidden), false);
        assert.equal(ok.value.projectionA.confidenceWording.includes('999'), false);
        assert.equal(ok.value.projectionA.explanation.includes(String(hiddenClaim)), false);

        // Invalid declassification rule
        const badDeclass = await laws.proveVisibleEquivalence({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          basis,
          authorizedCandidates,
          withHiddenRivalCandidates: withHidden,
          declassificationRule: { released: true, ruleDigest: 'nope' } as never,
        });
        assert.equal(badDeclass.tag, 'Denied');
        if (badDeclass.tag === 'Denied') assert.equal(badDeclass.reason, 'DECLASSIFICATION_INVALID');

        // Pair mismatch: authorized sets diverge
        const diverge = await laws.proveVisibleEquivalence({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          basis,
          authorizedCandidates,
          withHiddenRivalCandidates: Object.freeze([
            Object.freeze({
              claimId: uuid(randomUUID()),
              predicateId: 'qty',
              subjectId,
              amount: '1',
              unitOrCurrency: 'EA',
              authorized: true,
            }),
            Object.freeze({
              claimId: hiddenClaim,
              predicateId: 'qty',
              subjectId,
              amount: fx.amountRivalHidden,
              unitOrCurrency: 'EA',
              authorized: false,
            }),
          ]),
        });
        assert.equal(diverge.tag, 'Denied');
        if (diverge.tag === 'Denied') assert.equal(diverge.reason, 'PAIR_MISMATCH');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0036-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const laws = new InterpretationLaws(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = uuid(randomUUID());
        const authClaim = uuid(randomUUID());
        const hiddenClaim = uuid(randomUUID());
        const basis = Object.freeze({
          releaseDigest: fx.releaseDigest,
          cutDigest: fx.cutDigest,
          knowledgeVersion: 1,
          perspective: fx.perspective,
        });
        const authorizedCandidates = Object.freeze([
          Object.freeze({
            claimId: authClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountAuthorized,
            unitOrCurrency: 'EA',
            authorized: true,
          }),
        ]);
        const withHidden = Object.freeze([
          ...authorizedCandidates,
          Object.freeze({
            claimId: hiddenClaim,
            predicateId: 'qty',
            subjectId,
            amount: fx.amountRivalHidden,
            unitOrCurrency: 'EA',
            authorized: false,
          }),
        ]);
        const operationId = uuid(randomUUID());
        const payload = {
          world,
          operationId,
          queryDigest: fx.queryDigest,
          basis,
          authorizedCandidates,
          withHiddenRivalCandidates: withHidden,
        } as const;

        const raced = await Promise.all([
          laws.proveVisibleEquivalence(payload),
          laws.proveVisibleEquivalence(payload),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('race');
        assert.equal(raced[0]!.value.proofId, raced[1]!.value.proofId);
        assert.equal(raced[0]!.value.resultDigest, raced[1]!.value.resultDigest);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.value.firstRun).length, 1);

        const count = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.interpretation_law_proofs WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(count.rows[0]?.n, 1);

        // Cut replay: deterministic at same basis; changed cut distinguished
        const replay = await laws.replayCuts({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          candidates: authorizedCandidates,
          basisAtCut: basis,
          replayCutDigest: fx.priorCutDigest,
          expectedCutDigest: fx.cutDigest,
        });
        assert.equal(replay.tag, 'Ok');
        if (replay.tag !== 'Ok') throw new Error('replay');
        assert.equal(replay.value.kind, 'cut-replay');
        assert.notEqual(replay.value.observableDigestA, replay.value.observableDigestB);
        assert.equal(replay.value.projectionA.cutDigest, fx.cutDigest);
        assert.equal(replay.value.projectionB?.cutDigest, fx.priorCutDigest);

        // Stale when expected cut mismatches basis
        const stale = await laws.replayCuts({
          world,
          operationId: uuid(randomUUID()),
          queryDigest: fx.queryDigest,
          candidates: authorizedCandidates,
          basisAtCut: basis,
          replayCutDigest: fx.priorCutDigest,
          expectedCutDigest: fx.priorCutDigest,
        });
        assert.equal(stale.tag, 'Stale');
        if (stale.tag === 'Stale') assert.equal(stale.reason, 'CUT_MISMATCH');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0036Tests();
