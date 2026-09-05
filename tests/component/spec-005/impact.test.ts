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
const FIXTURE_SEED = 'zn-0035-impact-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/impact.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/impact.schema.json');
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
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0035-emit-${process.pid}`);
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
  caseId: string;
  questionDigest: string;
  cutDigest: string;
  priorCutDigest: string;
  deliveryDateBefore: string;
  deliveryDateAfter: string;
  planNodeId: string;
  caseNodeId: string;
  invoiceNodeId: string;
  projectionNodeId: string;
  deliveryClaimNodeId: string;
  invoiceClaimNodeId: string;
  budget: number;
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

async function registerZn0035Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { ImpactService } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/impact.js'
  );
  const { CorrectionService } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/correction.js'
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

  async function seedGraph(
    impact: InstanceType<typeof ImpactService>,
    world: { worldId: ReturnType<typeof uuid>; realm: 'live' },
    fx: Fixture,
    orderSubject: ReturnType<typeof uuid>,
    invoiceSubject: ReturnType<typeof uuid>,
  ) {
    const nodes = [
      { nodeId: fx.deliveryClaimNodeId, kind: 'claim' as const, subjectId: orderSubject },
      { nodeId: fx.planNodeId, kind: 'interpretation' as const, subjectId: orderSubject },
      { nodeId: fx.caseNodeId, kind: 'case' as const, subjectId: orderSubject },
      { nodeId: fx.projectionNodeId, kind: 'projection' as const, subjectId: orderSubject },
      { nodeId: fx.invoiceClaimNodeId, kind: 'claim' as const, subjectId: invoiceSubject },
      { nodeId: fx.invoiceNodeId, kind: 'interpretation' as const, subjectId: invoiceSubject },
    ];
    for (const n of nodes) {
      const r = await impact.registerNode({
        world,
        nodeId: n.nodeId,
        kind: n.kind,
        cutDigest: fx.cutDigest,
        subjectId: n.subjectId,
        authorized: true,
      });
      assert.equal(r.tag, 'Ok', `register ${n.nodeId}`);
    }
    // plan depends on delivery claim; case depends on plan; projection depends on plan
    // invoice depends on invoice claim only
    const edges = [
      { fromId: fx.planNodeId, fromKind: 'interpretation' as const, toId: fx.deliveryClaimNodeId, toKind: 'claim' as const },
      { fromId: fx.caseNodeId, fromKind: 'case' as const, toId: fx.planNodeId, toKind: 'interpretation' as const },
      { fromId: fx.projectionNodeId, fromKind: 'projection' as const, toId: fx.planNodeId, toKind: 'interpretation' as const },
      { fromId: fx.invoiceNodeId, fromKind: 'interpretation' as const, toId: fx.invoiceClaimNodeId, toKind: 'claim' as const },
    ];
    for (const e of edges) {
      const r = await impact.registerEdge({ world, ...e });
      assert.equal(r.tag, 'Ok');
    }
  }

  test('ZN-0035-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const impact = new ImpactService(db, testCrypto);
      const correction = new CorrectionService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const actorId = uuid(seeded.principalId);
        const orderSubject = uuid(randomUUID());
        const invoiceSubject = uuid(randomUUID());
        const targetClaimId = uuid(randomUUID());

        await seedGraph(impact, world, fx, orderSubject, invoiceSubject);

        const applied = await correction.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards: Object.freeze({
            caseId: fx.caseId,
            questionDigest: fx.questionDigest,
            authorityPrincipalId: actorId,
            scopedSubjectId: orderSubject,
            validFrom: '2026-01-01',
            validUntil: '2027-01-01',
            cutDigest: fx.cutDigest,
          }),
          actorId,
          answerKind: 'assertion',
          targetClaimId,
          successorValue: fx.deliveryDateAfter,
          evidenceRefs: Object.freeze(['ev-delivery-correction']),
        });
        assert.equal(applied.tag, 'Ok');
        if (applied.tag !== 'Ok') throw new Error('correction');

        const consumed = await impact.consumeCorrection({
          world,
          operationId: uuid(randomUUID()),
          correctionId: applied.value.correctionId,
          sourceCutDigest: fx.cutDigest,
          scopedSubjectId: orderSubject,
          targetClaimId,
          targetClaimNodeId: fx.deliveryClaimNodeId,
          budget: fx.budget,
        });
        assert.equal(consumed.tag, 'Ok');
        if (consumed.tag !== 'Ok') throw new Error('consume');

        const plan = await impact.nodeStatus(world, fx.planNodeId);
        const depCase = await impact.nodeStatus(world, fx.caseNodeId);
        const proj = await impact.nodeStatus(world, fx.projectionNodeId);
        const invoice = await impact.nodeStatus(world, fx.invoiceNodeId);

        assert.equal(plan?.status, 'stale');
        assert.equal(depCase?.status, 'stale');
        assert.equal(proj?.status, 'pending');
        assert.equal(invoice?.status, 'valid');

        assert.ok(consumed.value.invalidatedNodeIds.includes(fx.planNodeId));
        assert.ok(consumed.value.invalidatedNodeIds.includes(fx.caseNodeId));
        assert.ok(consumed.value.invalidatedNodeIds.includes(fx.projectionNodeId));
        assert.equal(consumed.value.invalidatedNodeIds.includes(fx.invoiceNodeId), false);
        assert.ok(consumed.value.untouchedNodeIds.includes(fx.invoiceNodeId));

        const q = consumed.value.quality;
        assert.ok(q.affectedScope.nodeIds.includes(fx.planNodeId));
        assert.ok(q.affectedScope.projectionLag.pendingCount >= 1);
        assert.equal(q.affectedScope.projectionLag.sourceCutDigest, fx.cutDigest);
        assert.equal(q.affectedScope.projectionLag.coveredCutDigest, null);
        assert.ok(q.freshness.staleNodes >= 2);
        assert.ok(q.coverage.totalAuthorizedNodes >= 5);
        assert.match(q.coverage.ratio, /^\d+\/\d+$/);
        assert.match(q.reversalRate.ratio, /^\d+\/\d+$/);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0035-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const impact = new ImpactService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const orderSubject = uuid(randomUUID());
        const invoiceSubject = uuid(randomUUID());
        await seedGraph(impact, world, fx, orderSubject, invoiceSubject);

        // Forbidden rival evidence node depending on the same claim — unauthorized
        const rivalId = 'rival-forbidden-interp';
        const rivalReg = await impact.registerNode({
          world,
          nodeId: rivalId,
          kind: 'interpretation',
          cutDigest: fx.cutDigest,
          subjectId: orderSubject,
          authorized: false,
        });
        assert.equal(rivalReg.tag, 'Ok');
        const rivalEdge = await impact.registerEdge({
          world,
          fromId: rivalId,
          fromKind: 'interpretation',
          toId: fx.deliveryClaimNodeId,
          toKind: 'claim',
        });
        assert.equal(rivalEdge.tag, 'Ok');

        const consumed = await impact.consumeCorrection({
          world,
          operationId: uuid(randomUUID()),
          correctionId: uuid(randomUUID()),
          sourceCutDigest: fx.cutDigest,
          scopedSubjectId: orderSubject,
          targetClaimId: uuid(randomUUID()),
          targetClaimNodeId: fx.deliveryClaimNodeId,
          budget: fx.budget,
        });
        assert.equal(consumed.tag, 'Ok');
        if (consumed.tag !== 'Ok') throw new Error('consume');

        // Rival must not appear in authorized impact output
        assert.equal(consumed.value.invalidatedNodeIds.includes(rivalId), false);
        assert.equal(JSON.stringify(consumed.value.quality).includes(rivalId), false);
        assert.equal(JSON.stringify(consumed.value.quality).includes('rival-forbidden'), false);

        const rivalStatus = await impact.nodeStatus(world, rivalId);
        assert.equal(rivalStatus?.authorized, false);
        // Unauthorized node remains valid (not invalidated into authorized wording)
        assert.equal(rivalStatus?.status, 'valid');

        // Invalid input denied
        const bad = await impact.consumeCorrection({
          world,
          operationId: uuid(randomUUID()),
          correctionId: uuid(randomUUID()),
          sourceCutDigest: 'not-a-digest',
          scopedSubjectId: orderSubject,
          targetClaimId: uuid(randomUUID()),
          targetClaimNodeId: fx.deliveryClaimNodeId,
        });
        assert.equal(bad.tag, 'Denied');
        if (bad.tag === 'Denied') assert.equal(bad.reason, 'INVALID_INPUT');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0035-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const impact = new ImpactService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const orderSubject = uuid(randomUUID());
        const invoiceSubject = uuid(randomUUID());
        await seedGraph(impact, world, fx, orderSubject, invoiceSubject);

        const operationId = uuid(randomUUID());
        const correctionId = uuid(randomUUID());
        const targetClaimId = uuid(randomUUID());
        const payload = {
          world,
          operationId,
          correctionId,
          sourceCutDigest: fx.cutDigest,
          scopedSubjectId: orderSubject,
          targetClaimId,
          targetClaimNodeId: fx.deliveryClaimNodeId,
          budget: fx.budget,
        } as const;

        const raced = await Promise.all([
          impact.consumeCorrection(payload),
          impact.consumeCorrection(payload),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(raced[0]!.value.runId, raced[1]!.value.runId);
        assert.equal(raced[0]!.value.resultDigest, raced[1]!.value.resultDigest);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.value.firstRun).length, 1);

        const count = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.impact_runs WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(count.rows[0]?.n, 1);

        // Stale on cut mismatch
        const stale = await impact.consumeCorrection({
          ...payload,
          operationId: uuid(randomUUID()),
          expectedGraphCutDigest: fx.priorCutDigest,
        });
        assert.equal(stale.tag, 'Stale');
        if (stale.tag === 'Stale') assert.equal(stale.reason, 'CUT_MISMATCH');

        // Cycle denial: add back-edge plan -> claim already exists; add claim -> plan
        const cycleEdge = await impact.registerEdge({
          world,
          fromId: fx.deliveryClaimNodeId,
          fromKind: 'claim',
          toId: fx.planNodeId,
          toKind: 'interpretation',
        });
        assert.equal(cycleEdge.tag, 'Ok');
        // Reset nodes to valid for a fresh consume path — use new claim seed via fresh graph world not needed;
        // cycle detection walks dependents; with mutual edges visited+onStack triggers CYCLE.
        // Use a tiny isolated cycle graph
        await impact.registerNode({
          world,
          nodeId: 'cycle-a',
          kind: 'claim',
          cutDigest: fx.cutDigest,
          authorized: true,
        });
        await impact.registerNode({
          world,
          nodeId: 'cycle-b',
          kind: 'interpretation',
          cutDigest: fx.cutDigest,
          authorized: true,
        });
        await impact.registerEdge({
          world,
          fromId: 'cycle-b',
          fromKind: 'interpretation',
          toId: 'cycle-a',
          toKind: 'claim',
        });
        await impact.registerEdge({
          world,
          fromId: 'cycle-a',
          fromKind: 'claim',
          toId: 'cycle-b',
          toKind: 'interpretation',
        });
        const cycled = await impact.consumeCorrection({
          world,
          operationId: uuid(randomUUID()),
          correctionId: uuid(randomUUID()),
          sourceCutDigest: fx.cutDigest,
          scopedSubjectId: orderSubject,
          targetClaimId: uuid(randomUUID()),
          targetClaimNodeId: 'cycle-a',
          budget: fx.budget,
        });
        assert.equal(cycled.tag, 'Denied');
        if (cycled.tag === 'Denied') assert.equal(cycled.reason, 'CYCLE');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0035Tests();
