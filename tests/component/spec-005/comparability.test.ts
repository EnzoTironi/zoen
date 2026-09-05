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
const FIXTURE_SEED = 'zn-0031-comparability-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/comparability.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/comparability.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0031_comparability.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0031-emit-${process.pid}`);
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
  profileId: string;
  knowledgeVersion: number;
  releaseDigest: string;
  companyId: string;
  bookings: string;
  invoiced: string;
  received: string;
  currency: string;
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

async function registerZn0031Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { ClaimComparer, buildComparisonKey, metricLabelForPredicate } = await import(
    '../../../.core-build/packages/ontology/src/interpretation/comparability.js'
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

  function claim(partial: {
    claimId?: string;
    subjectId: string;
    predicateId: string;
    amount: string;
    currency: string;
    companyId: string;
    authorized?: boolean;
    validFrom?: string;
    validUntil?: string | null;
  }) {
    return Object.freeze({
      claimId: uuid(partial.claimId ?? randomUUID()),
      subjectId: uuid(partial.subjectId),
      predicateId: partial.predicateId,
      amount: partial.amount,
      unitOrCurrency: partial.currency,
      measureKind: 'money' as const,
      scope: Object.freeze({ companyId: partial.companyId }),
      validFrom: partial.validFrom ?? '2026-01-01',
      validUntil: partial.validUntil === undefined ? '2027-01-01' : partial.validUntil,
      authorized: partial.authorized ?? true,
      evidenceRefs: Object.freeze([`ev-${partial.predicateId}`]),
    });
  }

  function profile(fx: Fixture, overrides: Partial<{ knowledgeVersion: number; releaseDigest: string }> = {}) {
    return Object.freeze({
      profileId: fx.profileId,
      knowledgeVersion: overrides.knowledgeVersion ?? fx.knowledgeVersion,
      releaseDigest: overrides.releaseDigest ?? fx.releaseDigest,
      releasedConversions: Object.freeze([] as const),
    });
  }

  test('ZN-0031-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(metricLabelForPredicate('crm.bookings'), 'bookings');
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const comparer = new ClaimComparer(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = fx.companyId;
        const claims = Object.freeze([
          claim({
            subjectId,
            predicateId: 'crm.bookings',
            amount: fx.bookings,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
          claim({
            subjectId,
            predicateId: 'erp.invoiced',
            amount: fx.invoiced,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
          claim({
            subjectId,
            predicateId: 'bank.received',
            amount: fx.received,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
        ]);

        // Distinct comparison keys — not one shared numerical arena
        const keys = new Set(claims.map((c) => buildComparisonKey(c)));
        assert.equal(keys.size, 3);

        const result = await comparer.compareClaims({
          world,
          claims,
          meaningProfile: profile(fx),
        });
        assert.equal(result.tag, 'Ok');
        if (result.tag !== 'Ok') throw new Error('expected Ok');

        assert.equal(result.winnerSelected, false);
        assert.equal(result.numericalContradiction, false);
        assert.equal(result.groups.length, 3);
        const labels = new Set(result.groups.map((g) => g.metricLabel));
        assert.deepEqual([...labels].sort(), ['bookings', 'invoiced', 'received']);
        assert.ok(result.explanations.some((e) => e.includes('Distinct semantic predicates')));
        assert.ok(result.partitions.some((p) => p.reason === 'DISTINCT_PREDICATE'));
        assert.equal(result.firstRun, true);
        assert.equal(result.authorizedClaimCount, 3);
        assert.equal(result.omittedUnauthorizedCount, 0);

        // Replay identical input → same digest, not a second semantic winner
        const again = await comparer.compareClaims({
          world,
          claims,
          meaningProfile: profile(fx),
        });
        assert.equal(again.tag, 'Ok');
        if (again.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(again.firstRun, false);
        assert.equal(again.resultDigest, result.resultDigest);
        assert.equal(again.runId, result.runId);
        assert.equal(again.winnerSelected, false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0031-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const comparer = new ClaimComparer(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = fx.companyId;

        const authorizedOnly = Object.freeze([
          claim({
            subjectId,
            predicateId: 'crm.bookings',
            amount: fx.bookings,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
        ]);
        const withForbidden = Object.freeze([
          ...authorizedOnly,
          claim({
            subjectId,
            predicateId: 'crm.bookings',
            amount: '999999.00',
            currency: fx.currency,
            companyId: fx.companyId,
            authorized: false,
          }),
          claim({
            subjectId,
            predicateId: 'shadow.rival',
            amount: '42.00',
            currency: fx.currency,
            companyId: fx.companyId,
            authorized: false,
          }),
        ]);

        const base = await comparer.compareClaims({
          world,
          claims: authorizedOnly,
          meaningProfile: profile(fx),
        });
        assert.equal(base.tag, 'Ok');
        if (base.tag !== 'Ok') throw new Error('expected Ok');

        const mixed = await comparer.compareClaims({
          world,
          claims: withForbidden,
          meaningProfile: profile(fx),
        });
        assert.equal(mixed.tag, 'Ok');
        if (mixed.tag !== 'Ok') throw new Error('expected Ok');

        // Forbidden rivals must not alter authorized groups, contradiction flag, or explanations wording about rivals
        assert.equal(mixed.authorizedClaimCount, 1);
        assert.equal(mixed.omittedUnauthorizedCount, 2);
        assert.equal(mixed.groups.length, base.groups.length);
        assert.equal(mixed.groups[0]!.metricLabel, 'bookings');
        assert.deepEqual([...mixed.groups[0]!.amounts], [...base.groups[0]!.amounts]);
        assert.equal(mixed.numericalContradiction, base.numericalContradiction);
        assert.equal(mixed.winnerSelected, false);
        const leaked = JSON.stringify(mixed).includes('999999') || JSON.stringify(mixed.groups).includes('shadow.rival');
        assert.equal(leaked, false);

        // Invalid claim denied; no durable side effect for empty/invalid
        const denied = await comparer.compareClaims({
          world,
          claims: Object.freeze([
            claim({
              subjectId,
              predicateId: 'crm.bookings',
              amount: 'not-a-number',
              currency: fx.currency,
              companyId: fx.companyId,
            }),
          ]),
          meaningProfile: profile(fx),
        });
        assert.equal(denied.tag, 'Denied');
        if (denied.tag === 'Denied') assert.equal(denied.reason, 'INVALID_CLAIM');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0031-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const comparer = new ClaimComparer(db, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        const subjectId = fx.companyId;
        const claims = Object.freeze([
          claim({
            subjectId,
            predicateId: 'crm.bookings',
            amount: fx.bookings,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
          claim({
            subjectId,
            predicateId: 'erp.invoiced',
            amount: fx.invoiced,
            currency: fx.currency,
            companyId: fx.companyId,
          }),
        ]);
        const meaning = profile(fx);

        // Concurrent identical compare — at most one firstRun / one durable row
        const raced = await Promise.all([
          comparer.compareClaims({ world, claims, meaningProfile: meaning }),
          comparer.compareClaims({ world, claims, meaningProfile: meaning }),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag !== 'Ok' || raced[1]!.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(raced[0]!.resultDigest, raced[1]!.resultDigest);
        assert.equal(raced[0]!.runId, raced[1]!.runId);
        assert.equal(raced.filter((r) => r.tag === 'Ok' && r.firstRun).length, 1);

        const runs = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.comparison_runs WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(runs.rows[0]?.n, 1);

        // Same input, changed knowledge basis → distinct run (explicit basis change; not silent overwrite)
        const changed = await comparer.compareClaims({
          world,
          claims,
          meaningProfile: profile(fx, { knowledgeVersion: fx.knowledgeVersion + 1 }),
        });
        assert.equal(changed.tag, 'Ok');
        if (changed.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(changed.firstRun, true);
        assert.notEqual(changed.runId, raced[0]!.runId);
        assert.notEqual(changed.meaningBasis, raced[0]!.meaningBasis);

        const runs2 = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.comparison_runs WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(runs2.rows[0]?.n, 2);

        // Deterministic at same basis
        const again = await comparer.compareClaims({ world, claims, meaningProfile: meaning });
        assert.equal(again.tag, 'Ok');
        if (again.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(again.resultDigest, raced[0]!.resultDigest);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0031Tests();
