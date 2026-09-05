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
const FIXTURE_SEED = 'zn-0034-correction-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/correction.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/correction.schema.json');
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
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0034-emit-${process.pid}`);
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
  amountBefore: string;
  amountAfter: string;
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

async function registerZn0034Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { CorrectionService } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/correction.js'
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

  test('ZN-0034-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const svc = new CorrectionService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const actorId = uuid(seeded.principalId);
        const orderSubject = uuid(randomUUID());
        const otherSubject = uuid(randomUUID());
        const targetClaimId = uuid(randomUUID());
        const guards = Object.freeze({
          caseId: fx.caseId,
          questionDigest: fx.questionDigest,
          authorityPrincipalId: actorId,
          scopedSubjectId: orderSubject,
          validFrom: '2026-01-01',
          validUntil: '2027-01-01',
          cutDigest: fx.cutDigest,
        });

        const applied = await svc.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId,
          answerKind: 'assertion',
          targetClaimId,
          successorValue: fx.amountAfter,
          evidenceRefs: Object.freeze(['ev-human-1']),
          installRule: false,
        });
        assert.equal(applied.tag, 'Ok');
        if (applied.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(applied.value.ruleCreated, false);
        assert.equal(applied.value.retracted, false);
        assert.equal(applied.value.answerKind, 'assertion');
        assert.equal(String(applied.value.scopedSubjectId), String(orderSubject));

        // Prior cut has no correction — replays prior interpretation (null active)
        const priorView = await svc.activeCorrectionAtCut(world, orderSubject, fx.priorCutDigest);
        assert.equal(priorView, null);

        // Current cut sees the correction
        const currentView = await svc.activeCorrectionAtCut(world, orderSubject, fx.cutDigest);
        assert.ok(currentView);
        assert.equal(currentView!.correctionId, applied.value.correctionId);

        // Other subject untouched
        const otherView = await svc.activeCorrectionAtCut(world, otherSubject, fx.cutDigest);
        assert.equal(otherView, null);

        // Retract via new receipt — prior row remains, marked retracted
        const retracted = await svc.retractCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId,
          correctionId: applied.value.correctionId,
        });
        assert.equal(retracted.tag, 'Ok');
        if (retracted.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(retracted.value.answerKind, 'retraction');
        assert.equal(retracted.value.retracted, true);
        assert.equal(retracted.value.retractsCorrectionId, String(applied.value.correctionId));
        assert.equal(retracted.value.ruleCreated, false);

        const afterRetract = await svc.activeCorrectionAtCut(world, orderSubject, fx.cutDigest);
        assert.equal(afterRetract, null);

        // Original correction row still present (not deleted)
        const rows = await pool.query<{ n: number; retracted: boolean }>(
          `SELECT count(*)::int AS n, bool_or(retracted) AS retracted
           FROM ontology.corrections
           WHERE world_id=$1::uuid AND correction_id=$2::uuid`,
          [seeded.worldId, applied.value.correctionId],
        );
        assert.equal(rows.rows[0]?.n, 1);
        assert.equal(rows.rows[0]?.retracted, true);

        // No rule ever created
        const rules = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.corrections
           WHERE world_id=$1::uuid AND rule_created=true`,
          [seeded.worldId],
        );
        assert.equal(rules.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0034-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const svc = new CorrectionService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const actorId = uuid(seeded.principalId);
        const orderSubject = uuid(randomUUID());
        const guards = Object.freeze({
          caseId: fx.caseId,
          questionDigest: fx.questionDigest,
          authorityPrincipalId: actorId,
          scopedSubjectId: orderSubject,
          validFrom: '2026-01-01',
          validUntil: '2027-01-01',
          cutDigest: fx.cutDigest,
        });

        // installRule forbidden
        const ruleAttempt = await svc.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId,
          answerKind: 'assertion',
          targetClaimId: uuid(randomUUID()),
          successorValue: fx.amountAfter,
          evidenceRefs: Object.freeze([]),
          installRule: true,
        });
        assert.equal(ruleAttempt.tag, 'Denied');
        if (ruleAttempt.tag === 'Denied') assert.equal(ruleAttempt.reason, 'RULE_INSTALL_FORBIDDEN');

        // Wrong authority
        const wrongActor = await svc.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId: uuid(randomUUID()),
          answerKind: 'assertion',
          targetClaimId: uuid(randomUUID()),
          successorValue: fx.amountAfter,
          evidenceRefs: Object.freeze([]),
        });
        assert.equal(wrongActor.tag, 'Denied');
        if (wrongActor.tag === 'Denied') assert.equal(wrongActor.reason, 'AUTHORITY_MISMATCH');

        // Authorized apply then ensure forbidden rival subject correction does not leak
        const ok = await svc.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId,
          answerKind: 'assertion',
          targetClaimId: uuid(randomUUID()),
          successorValue: fx.amountAfter,
          evidenceRefs: Object.freeze(['ev-ok']),
        });
        assert.equal(ok.tag, 'Ok');
        if (ok.tag !== 'Ok') throw new Error('expected Ok');

        const rivalSubject = uuid(randomUUID());
        const rivalGuards = Object.freeze({ ...guards, scopedSubjectId: rivalSubject, caseId: 'other-case' });
        // Rival applies under different scope — must not appear in original subject view
        const rival = await svc.applyCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards: rivalGuards,
          actorId,
          answerKind: 'assertion',
          targetClaimId: uuid(randomUUID()),
          successorValue: '999',
          evidenceRefs: Object.freeze(['ev-rival-forbidden']),
        });
        assert.equal(rival.tag, 'Ok');
        const view = await svc.activeCorrectionAtCut(world, orderSubject, fx.cutDigest);
        assert.ok(view);
        assert.equal(view!.correctionId, ok.value.correctionId);
        assert.equal(JSON.stringify(view).includes('999'), false);
        assert.equal(JSON.stringify(view).includes('ev-rival-forbidden'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0034-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const svc = new CorrectionService(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const actorId = uuid(seeded.principalId);
        const orderSubject = uuid(randomUUID());
        const targetClaimId = uuid(randomUUID());
        const operationId = uuid(randomUUID());
        const guards = Object.freeze({
          caseId: fx.caseId,
          questionDigest: fx.questionDigest,
          authorityPrincipalId: actorId,
          scopedSubjectId: orderSubject,
          validFrom: '2026-01-01',
          validUntil: '2027-01-01',
          cutDigest: fx.cutDigest,
        });

        const raced = await Promise.all([
          svc.applyCorrection({
            world,
            operationId,
            guards,
            actorId,
            answerKind: 'assertion',
            targetClaimId,
            successorValue: fx.amountAfter,
            evidenceRefs: Object.freeze(['ev-1']),
          }),
          svc.applyCorrection({
            world,
            operationId,
            guards,
            actorId,
            answerKind: 'assertion',
            targetClaimId,
            successorValue: fx.amountAfter,
            evidenceRefs: Object.freeze(['ev-1']),
          }),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(raced[0]!.value.correctionId, raced[1]!.value.correctionId);
        assert.equal(raced[0]!.value.resultDigest, raced[1]!.value.resultDigest);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.value.firstRun).length, 1);

        const count = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.corrections
           WHERE world_id=$1::uuid AND answer_kind='assertion'`,
          [seeded.worldId],
        );
        assert.equal(count.rows[0]?.n, 1);

        // Stale: retract already-retracted → ALREADY_RETRACTED
        const retractOp = uuid(randomUUID());
        const r1 = await svc.retractCorrection({
          world,
          operationId: retractOp,
          guards,
          actorId,
          correctionId: raced[0]!.value.correctionId,
        });
        assert.equal(r1.tag, 'Ok');
        const r2 = await svc.retractCorrection({
          world,
          operationId: uuid(randomUUID()),
          guards,
          actorId,
          correctionId: raced[0]!.value.correctionId,
        });
        assert.equal(r2.tag, 'Stale');
        if (r2.tag === 'Stale') assert.equal(r2.reason, 'ALREADY_RETRACTED');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0034Tests();
