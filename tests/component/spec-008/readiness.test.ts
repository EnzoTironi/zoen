import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0048-readiness-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-008/readiness.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-008/readiness.schema.json');
const SQLS = [
  'db/migrations/zn-0047_redaction.sql',
  'db/migrations/zn-0048_readiness.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0048-emit-${process.pid}`);
  mkdirSync(cfgDir, { recursive: true });
  const cfg = join(cfgDir, 'tsconfig.json');
  writeFileSync(
    cfg,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2023'],
        types: [],
        strict: true,
        skipLibCheck: true,
        noEmitOnError: true,
        rootDir: join(ROOT, 'packages/telemetry/src'),
        outDir: join(OUT, 'packages/telemetry/src'),
        declaration: false,
      },
      include: [
        join(ROOT, 'packages/telemetry/src/readiness.ts'),
        join(ROOT, 'packages/telemetry/src/redaction.ts'),
        join(ROOT, 'packages/telemetry/src/types.ts'),
        join(ROOT, 'packages/telemetry/src/ports.ts'),
        join(ROOT, 'packages/telemetry/src/index.ts'),
      ],
    }),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', env: process.env });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();

type Fixture = {
  seed: string;
  seedDigest: string;
  requiredMigrations: string[];
  admittedCapabilities: string[];
  unadmittedCapabilities: string[];
  cellId: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

async function resetSchemas(pool: pg.Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS jobs CASCADE`);
  await pool.query(`DROP SCHEMA IF EXISTS audit CASCADE`);
  for (const sql of SQLS) {
    assert.equal(existsSync(sql), true, `missing migration ${sql}`);
    await pool.query(readFileSync(sql, 'utf8'));
  }
}

function pgFenceStore(pool: pg.Pool) {
  return {
    async getFence(cellId: string) {
      const r = await pool.query<{
        cell_id: string;
        epoch: string;
        dispatch_enabled: boolean;
        deletion_ledger_cut: string | null;
      }>(
        `SELECT cell_id, epoch::text, dispatch_enabled, deletion_ledger_cut
         FROM jobs.recovery_fences WHERE cell_id = $1`,
        [cellId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        cellId: row.cell_id,
        epoch: Number(row.epoch),
        dispatchEnabled: row.dispatch_enabled,
        deletionLedgerCut: row.deletion_ledger_cut,
      };
    },
    async upsertFence(fence: {
      cellId: string;
      epoch: number;
      dispatchEnabled: boolean;
      deletionLedgerCut: string | null;
    }) {
      await pool.query(
        `INSERT INTO jobs.recovery_fences(cell_id, epoch, dispatch_enabled, deletion_ledger_cut)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cell_id) DO UPDATE SET
           epoch = EXCLUDED.epoch,
           dispatch_enabled = EXCLUDED.dispatch_enabled,
           deletion_ledger_cut = EXCLUDED.deletion_ledger_cut,
           updated_at = clock_timestamp()`,
        [fence.cellId, fence.epoch, fence.dispatchEnabled, fence.deletionLedgerCut],
      );
      return fence;
    },
  };
}

async function registerZn0048Tests(): Promise<void> {
  const { ReadinessService, READINESS_IMPL, isEffectsExplicitlyUnavailable } = await import(
    '../../../.core-build/packages/telemetry/src/readiness.js'
  );

  test('ZN-0048-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetSchemas(pool);
      const present = SQLS.map((p) => p.split('/').pop()!);
      const store = pgFenceStore(pool);
      const service = new ReadinessService({ store });

      const live = service.health();
      assert.equal(live.alive, true);

      const probe = {
        requiredMigrations: fx.requiredMigrations,
        migrationsPresent: present,
        locksCompatible: true,
        rolesCompatible: true,
        admittedCapabilities: fx.admittedCapabilities,
        unadmittedCapabilities: fx.unadmittedCapabilities,
      };

      const readyOut = service.readiness(probe);
      assert.equal(readyOut.tag, 'Ok', JSON.stringify(readyOut));
      if (readyOut.tag !== 'Ok') return;
      const deps = readyOut.value as {
        ready: boolean;
        coreUsable: boolean;
        effectsUnavailable: boolean;
        capabilities: { id: string; state: string; reason: string | null }[];
        impl: string;
      };
      assert.equal(deps.impl, READINESS_IMPL);
      assert.equal(deps.coreUsable, true);
      assert.equal(deps.ready, true);
      assert.equal(isEffectsExplicitlyUnavailable(deps), true);
      const effect = deps.capabilities.find((c) => c.id === 'effect-provider');
      assert.ok(effect);
      assert.equal(effect!.state, 'disabled');
      assert.equal(effect!.reason, 'UNADMITTED_PROVIDER');
      // Never fake-healthy for effects
      assert.equal(effect!.state === 'admitted', false);

      const disc = service.discoverCapabilities(probe);
      assert.equal(disc.tag, 'Ok');

      // Admit a request, complete it, then graceful drain — no duplicate semantic result
      const sem = 'op-s0-file-truth-1';
      const admitted = service.admitRequest(sem);
      assert.equal(admitted.tag, 'Ok');
      service.completeRequest(sem);
      const drain = await service.completeDrain(fx.cellId);
      assert.equal(drain.tag, 'Ok');
      assert.equal(drain.dispatchEnabled, false);
      assert.equal(drain.releasedJobIds.length, 1);

      // Second drain must not duplicate release semantic
      const drain2 = await service.releaseFencedJobs(fx.cellId);
      assert.equal(drain2.tag, 'Ok');
      assert.equal(drain2.duplicateSuppressed, true);
      assert.equal(drain2.releasedJobIds.length, 0);

      const rows = await pool.query<{ n: number; dispatch_enabled: boolean }>(
        `SELECT count(*)::int AS n, bool_and(dispatch_enabled = false) AS dispatch_enabled
         FROM jobs.recovery_fences WHERE cell_id = $1`,
        [fx.cellId],
      );
      assert.equal(rows.rows[0]!.n, 1);
      assert.equal(rows.rows[0]!.dispatch_enabled, true);

      // Replay completed semantic does not create duplicate work
      const replay = service.admitRequest(sem);
      assert.equal(replay.tag, 'Ok');
      if (replay.tag === 'Ok') {
        const v = replay.value as { status: string };
        assert.equal(v.status, 'already-completed');
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0048-NEG', async () => {
    const fx = fixture();
    const service = new ReadinessService({ store: null });

    // Secrets in telemetry/capability notes → fail safely
    const secretProbe = service.readiness({
      requiredMigrations: fx.requiredMigrations,
      migrationsPresent: fx.requiredMigrations,
      admittedCapabilities: fx.admittedCapabilities,
      unadmittedCapabilities: fx.unadmittedCapabilities,
      notes: 'password=super-secret-source-token',
    });
    assert.equal(secretProbe.tag, 'Denied');
    if (secretProbe.tag === 'Denied') assert.equal(secretProbe.reason, 'FORBIDDEN_PAYLOAD');

    // Restore without required ledger/dependencies → Blocked
    const restore = service.restoreAdmission({
      backupRef: 'backup://s0/fixture',
      deletionCut: null,
      effectLedger: null,
    });
    assert.equal(restore.tag, 'Blocked');
    if (restore.tag === 'Blocked') assert.equal(restore.reason, 'MISSING_LEDGER_OR_DEPENDENCY');

    // Incompatible migrations → not ready, core not usable, no fake healthy effects
    const badMig = service.readiness({
      requiredMigrations: fx.requiredMigrations,
      migrationsPresent: [],
      admittedCapabilities: fx.admittedCapabilities,
      unadmittedCapabilities: fx.unadmittedCapabilities,
    });
    assert.equal(badMig.tag, 'Ok');
    if (badMig.tag === 'Ok') {
      const deps = badMig.value as {
        ready: boolean;
        coreUsable: boolean;
        capabilities: { id: string; state: string }[];
      };
      assert.equal(deps.ready, false);
      assert.equal(deps.coreUsable, false);
      const effect = deps.capabilities.find((c) => c.id === 'effect-provider');
      assert.equal(effect?.state, 'disabled');
    }
  });

  test('ZN-0048-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetSchemas(pool);
      const store = pgFenceStore(pool);
      const service = new ReadinessService({ store, profileCapabilityLimit: 4 });

      // Seed an active fence
      await store.upsertFence({
        cellId: fx.cellId,
        epoch: 3,
        dispatchEnabled: true,
        deletionLedgerCut: 'cut-v1',
      });

      const probe = {
        requiredMigrations: fx.requiredMigrations,
        migrationsPresent: fx.requiredMigrations,
        admittedCapabilities: fx.admittedCapabilities,
        unadmittedCapabilities: fx.unadmittedCapabilities,
      };

      // Duplicate / reordered discovery preserves oracle
      const a = service.discoverCapabilities(probe);
      const b = service.discoverCapabilities({
        ...probe,
        admittedCapabilities: [...fx.admittedCapabilities].reverse(),
        unadmittedCapabilities: [...fx.unadmittedCapabilities].reverse(),
      });
      assert.equal(a.tag, 'Ok');
      assert.equal(b.tag, 'Ok');
      if (a.tag === 'Ok' && b.tag === 'Ok') {
        const da = a.value as { coreUsable: boolean; effectsUnavailable: boolean; ready: boolean };
        const db = b.value as { coreUsable: boolean; effectsUnavailable: boolean; ready: boolean };
        assert.equal(da.coreUsable, db.coreUsable);
        assert.equal(da.effectsUnavailable, db.effectsUnavailable);
        assert.equal(da.ready, db.ready);
      }

      // Profile limit → Unsupported rather than silent truncation
      const over = service.readiness({
        admittedCapabilities: ['a', 'b', 'c'],
        unadmittedCapabilities: ['d', 'e'],
      });
      assert.equal(over.tag, 'Unsupported');
      if (over.tag === 'Unsupported') assert.equal(over.reason, 'PROFILE_LIMIT');

      // Drain twice — second suppresses duplicate semantic release
      const d1 = await service.releaseFencedJobs(fx.cellId);
      assert.equal(d1.tag, 'Ok');
      assert.equal(d1.dispatchEnabled, false);
      assert.ok((d1.epoch ?? 0) >= 4);
      const d2 = await service.releaseFencedJobs(fx.cellId);
      assert.equal(d2.tag, 'Ok');
      assert.equal(d2.duplicateSuppressed, true);
      assert.equal(d2.releasedJobIds.length, 0);

      // Revoked / drain blocks new admissions
      service.beginDrain();
      const denied = service.admitRequest('new-after-drain');
      assert.equal(denied.tag, 'Denied');
      if (denied.tag === 'Denied') assert.equal(denied.reason, 'DRAINING');

      const fence = await store.getFence(fx.cellId);
      assert.ok(fence);
      assert.equal(fence!.dispatchEnabled, false);
    } finally {
      await pool.end();
    }
  });
}

await registerZn0048Tests();
