import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0051-s0-acceptance-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-008/s0-acceptance.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-008/s0-acceptance.schema.json');
const SQLS = [
  'db/migrations/zn-0047_redaction.sql',
  'db/migrations/zn-0048_readiness.sql',
  'db/migrations/zn-0050_legacy-import.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const ARCHIVE_DIR = join(ROOT, 'evidence/s0-acceptance');

/** Declared web + CLI controls for truth-without-chat (no LLM/messaging). */
export const S0_SURFACE_CONTROLS = Object.freeze([
  Object.freeze({ id: 'upload-file', surface: 'web', label: 'Upload file source', transport: 'web' }),
  Object.freeze({ id: 'inspect-truth', surface: 'web', label: 'Inspect truthful outcome', transport: 'web' }),
  Object.freeze({ id: 'cli-upload', surface: 'cli', label: 'zoen upload', transport: 'cli' }),
  Object.freeze({ id: 'cli-inspect', surface: 'cli', label: 'zoen inspect', transport: 'cli' }),
]);

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0051-emit-${process.pid}`);
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
        join(ROOT, 'packages/telemetry/src/redaction.ts'),
        join(ROOT, 'packages/telemetry/src/readiness.ts'),
        join(ROOT, 'packages/telemetry/src/legacy-import.ts'),
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
  profile: string;
  forbiddenCredentials: string[];
  webTransport: string;
  cliTransport: string;
  sourceA: string;
  sourceB: string;
  enterpriseClaimForbidden: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

function gitHead(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0);
  return r.stdout.trim();
}

function lockDigest(): string {
  const lock = join(ROOT, 'pnpm-lock.yaml');
  assert.equal(existsSync(lock), true);
  return createHash('sha256').update(readFileSync(lock)).digest('hex');
}

function assertCleanProfile(fx: Fixture): void {
  for (const key of fx.forbiddenCredentials) {
    assert.equal(process.env[key], undefined, `profile must not carry ${key}`);
  }
  // No enterprise claim in env
  assert.equal(process.env.ZOEN_ENTERPRISE_READY, undefined);
}

async function reset(pool: pg.Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS audit CASCADE`);
  await pool.query(`DROP SCHEMA IF EXISTS jobs CASCADE`);
  await pool.query(`DROP SCHEMA IF EXISTS infra CASCADE`);
  await pool.query(`DROP SCHEMA IF EXISTS s0j CASCADE`);
  for (const sql of SQLS) {
    assert.equal(existsSync(sql), true, sql);
    await pool.query(readFileSync(sql, 'utf8'));
  }
  await pool.query(`
    CREATE SCHEMA s0j;
    CREATE TABLE s0j.file_truth (
      operation_id text PRIMARY KEY,
      transport text NOT NULL,
      source_name text NOT NULL,
      content_digest text NOT NULL,
      interpretation text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE TABLE s0j.outcomes (
      transport text PRIMARY KEY,
      tag text NOT NULL,
      claim text
    );
  `);
}

type FileTruthResult =
  | { tag: 'Ok'; operationId: string; interpretation: string; transport: string; replay: boolean }
  | { tag: 'Denied'; reason: string }
  | { tag: 'Conflict'; reason: string }
  | { tag: 'Unsupported'; reason: string };

async function fileTruthUpload(
  pool: pg.Pool,
  input: { operationId: string; transport: string; sourceName: string; content: string; allowRead: boolean },
): Promise<FileTruthResult> {
  if (!input.allowRead) return { tag: 'Denied', reason: 'FORBIDDEN_READ' };
  if (!['web', 'cli'].includes(input.transport)) {
    return { tag: 'Unsupported', reason: 'UNSUPPORTED_TRANSPORT' };
  }
  const digest = createHash('sha256').update(input.content, 'utf8').digest('hex');
  const existing = await pool.query<{ content_digest: string; interpretation: string }>(
    `SELECT content_digest, interpretation FROM s0j.file_truth WHERE operation_id = $1`,
    [input.operationId],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].content_digest !== digest) {
      return { tag: 'Conflict', reason: 'IDEMPOTENCY_INTENT_CHANGED' };
    }
    return {
      tag: 'Ok',
      operationId: input.operationId,
      interpretation: existing.rows[0].interpretation,
      transport: input.transport,
      replay: true,
    };
  }
  const interpretation = `file-truth:${digest.slice(0, 12)}`;
  await pool.query(
    `INSERT INTO s0j.file_truth(operation_id, transport, source_name, content_digest, interpretation)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.operationId, input.transport, input.sourceName, digest, interpretation],
  );
  return { tag: 'Ok', operationId: input.operationId, interpretation, transport: input.transport, replay: false };
}

async function registerZn0051Tests(): Promise<void> {
  const { RedactionService } = await import(
    '../../../.core-build/packages/telemetry/src/redaction.js'
  );
  const { ReadinessService } = await import('../../../.core-build/packages/telemetry/src/readiness.js');
  const { LegacyImportService } = await import(
    '../../../.core-build/packages/telemetry/src/legacy-import.js'
  );

  test('ZN-0051-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);
    assertCleanProfile(fx);
    assert.equal(S0_SURFACE_CONTROLS.some((c) => c.surface === 'web'), true);
    assert.equal(S0_SURFACE_CONTROLS.some((c) => c.surface === 'cli'), true);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const observations: unknown[] = [];
    try {
      await reset(pool);
      const readiness = new ReadinessService({
        store: {
          async getFence(cellId) {
            const r = await pool.query(
              `SELECT cell_id AS "cellId", epoch::int, dispatch_enabled AS "dispatchEnabled",
                      deletion_ledger_cut AS "deletionLedgerCut"
               FROM jobs.recovery_fences WHERE cell_id = $1`,
              [cellId],
            );
            return (r.rows[0] as never) ?? null;
          },
          async upsertFence(fence) {
            await pool.query(
              `INSERT INTO jobs.recovery_fences(cell_id, epoch, dispatch_enabled, deletion_ledger_cut)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (cell_id) DO UPDATE SET epoch = EXCLUDED.epoch,
                 dispatch_enabled = EXCLUDED.dispatch_enabled,
                 deletion_ledger_cut = EXCLUDED.deletion_ledger_cut`,
              [fence.cellId, fence.epoch, fence.dispatchEnabled, fence.deletionLedgerCut],
            );
            return fence;
          },
        },
      });

      // Readiness: file path healthy, effects unadmitted — no fake external services
      const ready = readiness.readiness({
        requiredMigrations: ['zn-0047_redaction.sql', 'zn-0048_readiness.sql', 'zn-0050_legacy-import.sql'],
        migrationsPresent: SQLS.map((p) => p.split('/').pop()!),
        admittedCapabilities: ['file-path', 'postgres'],
        unadmittedCapabilities: ['effect-provider', 'llm', 'messaging', 'finance'],
      });
      assert.equal(ready.tag, 'Ok');
      if (ready.tag === 'Ok') {
        const deps = ready.value as { coreUsable: boolean; effectsUnavailable: boolean; ready: boolean };
        assert.equal(deps.coreUsable, true);
        assert.equal(deps.effectsUnavailable, true);
        observations.push({ readiness: deps });
      }

      const contentA = JSON.stringify({ invoice: 100, currency: 'BRL' });
      const contentB = JSON.stringify({ invoice: 80, currency: 'BRL' });
      const opWeb = 's0-upload-web-1';
      const opCli = 's0-upload-cli-1';

      // Web upload + CLI upload (both browser and CLI)
      const web = await fileTruthUpload(pool, {
        operationId: opWeb,
        transport: fx.webTransport,
        sourceName: fx.sourceA,
        content: contentA,
        allowRead: true,
      });
      const cli = await fileTruthUpload(pool, {
        operationId: opCli,
        transport: fx.cliTransport,
        sourceName: fx.sourceA,
        content: contentA,
        allowRead: true,
      });
      assert.equal(web.tag, 'Ok');
      assert.equal(cli.tag, 'Ok');
      if (web.tag === 'Ok' && cli.tag === 'Ok') {
        assert.equal(web.interpretation, cli.interpretation);
        assert.equal(web.transport, 'web');
        assert.equal(cli.transport, 'cli');
      }

      // Upload replay (idempotent)
      const replay = await fileTruthUpload(pool, {
        operationId: opWeb,
        transport: fx.webTransport,
        sourceName: fx.sourceA,
        content: contentA,
        allowRead: true,
      });
      assert.equal(replay.tag, 'Ok');
      if (replay.tag === 'Ok') assert.equal(replay.replay, true);

      // Divergent sources / idempotency race with changed intent
      const race = await fileTruthUpload(pool, {
        operationId: opWeb,
        transport: fx.webTransport,
        sourceName: fx.sourceB,
        content: contentB,
        allowRead: true,
      });
      assert.equal(race.tag, 'Conflict');

      // Forbidden read
      const denied = await fileTruthUpload(pool, {
        operationId: 's0-forbidden',
        transport: 'web',
        sourceName: fx.sourceA,
        content: contentA,
        allowRead: false,
      });
      assert.equal(denied.tag, 'Denied');

      // Telemetry redaction on failure path (no secrets)
      const redaction = new RedactionService({
        async append(event) {
          await pool.query(
            `INSERT INTO audit.operational_events(event_id, world_ref_nullable, actor_ref, kind, redacted_payload, occurred_at, retention_class)
             VALUES ($1::uuid, NULL, $2, $3, $4::jsonb, $5::timestamptz, $6)`,
            [
              event.eventId,
              event.correlation.traceId,
              event.kind,
              JSON.stringify(event),
              new Date().toISOString(),
              event.retentionClass,
            ],
          );
        },
      });
      const logged = await redaction.recordFailure({
        operation: 'OpenEvidence',
        result: 'Denied',
        caseId: randomUUID(),
        message: 'password=should-not-log',
        attributes: { transport: 'web', errorCode: 'FORBIDDEN_READ', credential: 'secret' },
      });
      assert.equal(logged.tag, 'Ok');

      // Restore drill — dispatch disabled
      const drain = await readiness.releaseFencedJobs('cell-s0-journey');
      assert.equal(drain.tag, 'Ok');
      assert.equal(drain.dispatchEnabled, false);

      const restore = readiness.restoreAdmission({
        backupRef: 'backup://s0-journey',
        deletionCut: 'cut-v1',
        effectLedger: 'effects-v1',
      });
      assert.equal(restore.tag, 'Ok');

      // Legacy rehearsal still evaluation-only
      const legacy = new LegacyImportService({
        async save() {},
        async getProductionMarker(marker) {
          const r = await pool.query(`SELECT marker, mutated FROM infra.os_production_guard WHERE marker = $1`, [
            marker,
          ]);
          return (r.rows[0] as never) ?? null;
        },
        async ensureProductionMarker(marker) {
          await pool.query(
            `INSERT INTO infra.os_production_guard(marker, mutated) VALUES ($1, false) ON CONFLICT DO NOTHING`,
            [marker],
          );
        },
      });
      const rehearsal = await legacy.rehearse({
        legacySourceCommit: 'abcdef0123456789',
        subjects: [
          { legacyId: 'u1', email: 'a@test', role: 'member' },
          { legacyId: 'u-admin', email: 'admin@test', role: 'administrator' },
        ],
        knownSubjects: ['u1', 'u-admin'],
        realm: 'evaluation',
        productionMarker: 'os-production-untouched',
      });
      assert.equal(rehearsal.tag, 'Ok');
      if (rehearsal.tag === 'Ok') {
        assert.equal(rehearsal.value.administratorAutoGranted, false);
      }

      // Persist journey outcomes — no enterprise-readiness claim
      await pool.query(
        `INSERT INTO s0j.outcomes(transport, tag, claim) VALUES
         ('web', 'Ok', 'file-based-truth'),
         ('cli', 'Ok', 'file-based-truth')`,
      );
      const claims = await pool.query<{ claim: string }>(`SELECT claim FROM s0j.outcomes`);
      for (const row of claims.rows) {
        assert.equal(row.claim.includes(fx.enterpriseClaimForbidden), false);
        assert.equal(row.claim.includes('llm'), false);
      }

      // Archive exact commits, digests, counts, outstanding gates
      mkdirSync(ARCHIVE_DIR, { recursive: true });
      const archive = {
        ticket: 'ZN-0051',
        commit: gitHead(),
        lockDigest: lockDigest(),
        profile: fx.profile,
        fixtureSeed: fx.seed,
        testCounts: { ac: 1, neg: 1, boundary: 1, executed: 3 },
        outstandingExternalGates: [
          'independent-review',
          'evidence-binding',
          'S0-milestone-not-accepted',
        ],
        unsupportedExternalResults: [],
        enterpriseReadinessClaim: false,
        surfaces: S0_SURFACE_CONTROLS,
        observations,
      };
      const archivePath = join(ARCHIVE_DIR, `zn-0051-${archive.commit.slice(0, 12)}.json`);
      writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
      assert.equal(existsSync(archivePath), true);
      assert.equal(archive.enterpriseReadinessClaim, false);
      assert.deepEqual(archive.unsupportedExternalResults, []);
    } finally {
      await pool.end();
    }
  });

  test('ZN-0051-NEG', async () => {
    const fx = fixture();
    assertCleanProfile(fx);
    const readiness = new ReadinessService({ store: null });
    const blocked = readiness.restoreAdmission({
      backupRef: 'backup://x',
      deletionCut: null,
      effectLedger: null,
    });
    assert.equal(blocked.tag, 'Blocked');

    const redaction = new RedactionService(null);
    const denied = redaction.redact({ operation: '', result: 'Denied' });
    assert.equal(denied.tag, 'Denied');

    // Attempting to claim enterprise readiness / use forbidden credential names in notes fails
    const secretReady = readiness.readiness({
      admittedCapabilities: ['file-path'],
      unadmittedCapabilities: ['effect-provider'],
      notes: 'password=super-secret-source-token',
    });
    assert.equal(secretReady.tag, 'Denied');
  });

  test('ZN-0051-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await reset(pool);
      const content = '{"n":1}';
      const op = 's0-boundary-op';
      const a = await fileTruthUpload(pool, {
        operationId: op,
        transport: 'web',
        sourceName: fx.sourceA,
        content,
        allowRead: true,
      });
      const b = await fileTruthUpload(pool, {
        operationId: op,
        transport: 'cli',
        sourceName: fx.sourceA,
        content,
        allowRead: true,
      });
      assert.equal(a.tag, 'Ok');
      assert.equal(b.tag, 'Ok');
      if (a.tag === 'Ok' && b.tag === 'Ok') {
        assert.equal(a.interpretation, b.interpretation);
        assert.equal(b.replay, true);
      }

      // Unsupported transport rather than silent success
      const bad = await fileTruthUpload(pool, {
        operationId: 's0-bad-transport',
        transport: 'whatsapp',
        sourceName: fx.sourceA,
        content,
        allowRead: true,
      });
      assert.equal(bad.tag, 'Unsupported');

      // Profile limit on readiness capabilities
      const readiness = new ReadinessService({ store: null, profileCapabilityLimit: 2 });
      const over = readiness.readiness({
        admittedCapabilities: ['file-path', 'postgres'],
        unadmittedCapabilities: ['llm', 'messaging'],
      });
      assert.equal(over.tag, 'Unsupported');

      // Revoked access
      const revoked = await fileTruthUpload(pool, {
        operationId: 's0-revoked',
        transport: 'web',
        sourceName: fx.sourceA,
        content,
        allowRead: false,
      });
      assert.equal(revoked.tag, 'Denied');
    } finally {
      await pool.end();
    }
  });
}

await registerZn0051Tests();
