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
const FIXTURE_SEED = 'zn-0050-legacy-import-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-008/legacy-import.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-008/legacy-import.schema.json');
const SQLS = ['db/migrations/zn-0050_legacy-import.sql'].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0050-emit-${process.pid}`);
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
        join(ROOT, 'packages/telemetry/src/legacy-import.ts'),
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
  legacyCommit: string;
  subjects: { legacyId: string; email: string; role: string }[];
  knownSubjects: string[];
  productionMarker: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

async function reset(pool: pg.Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS infra CASCADE`);
  for (const sql of SQLS) {
    assert.equal(existsSync(sql), true);
    await pool.query(readFileSync(sql, 'utf8'));
  }
}

function pgStore(pool: pg.Pool) {
  return {
    async save(manifest: {
      manifestId: string;
      version: string;
      legacySourceCommit: string;
      realm: string;
      rowCounts: unknown;
      rightsMapping: unknown;
      unmatchedRecords: unknown;
      semanticDiffs: unknown;
      cutoverApproved: boolean;
    }) {
      await pool.query(
        `INSERT INTO infra.migration_manifests(
           manifest_id, version, legacy_source_commit, realm, row_counts, rights_mapping,
           unmatched_records, semantic_diffs, cutover_approved)
         VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)`,
        [
          manifest.manifestId,
          manifest.version,
          manifest.legacySourceCommit,
          manifest.realm,
          JSON.stringify(manifest.rowCounts),
          JSON.stringify(manifest.rightsMapping),
          JSON.stringify(manifest.unmatchedRecords),
          JSON.stringify(manifest.semanticDiffs),
          manifest.cutoverApproved,
        ],
      );
    },
    async getProductionMarker(marker: string) {
      const r = await pool.query<{ marker: string; mutated: boolean }>(
        `SELECT marker, mutated FROM infra.os_production_guard WHERE marker = $1`,
        [marker],
      );
      return r.rows[0] ?? null;
    },
    async ensureProductionMarker(marker: string) {
      await pool.query(
        `INSERT INTO infra.os_production_guard(marker, mutated) VALUES ($1, false)
         ON CONFLICT (marker) DO NOTHING`,
        [marker],
      );
    },
  };
}

async function registerZn0050Tests(): Promise<void> {
  const { LegacyImportService, LEGACY_IMPORT_IMPL } = await import(
    '../../../.core-build/packages/telemetry/src/legacy-import.js'
  );

  test('ZN-0050-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await reset(pool);
      const store = pgStore(pool);
      const service = new LegacyImportService(store);

      const out = await service.rehearse({
        legacySourceCommit: fx.legacyCommit,
        subjects: fx.subjects,
        knownSubjects: fx.knownSubjects,
        realm: 'evaluation',
        productionMarker: fx.productionMarker,
      });
      assert.equal(out.tag, 'Ok', JSON.stringify(out));
      if (out.tag !== 'Ok') return;
      const m = out.value;
      assert.equal(m.realm, 'evaluation');
      assert.equal(m.cutoverApproved, false);
      assert.equal(m.administratorAutoGranted, false);
      assert.ok(m.unmatchedRecords.includes('user-orphan'));
      assert.ok(m.semanticDiffs.some((d: string) => d.startsWith('admin-denied:')));
      assert.ok(m.semanticDiffs.some((d: string) => d.startsWith('unmatched:')));
      assert.equal(m.rowCounts.rolesDenied, 1);
      assert.equal(m.rowCounts.unmatched, 1);
      assert.equal(m.rowCounts.admitted, 2);
      // administrator not auto-granted
      const admin = m.rightsMapping.find((r: { legacyId: string }) => r.legacyId === 'user-admin');
      assert.ok(admin);
      assert.equal(admin.admitted, false);
      assert.equal(admin.mappedRole, null);

      // OS production unchanged
      const guard = await pool.query<{ mutated: boolean }>(
        `SELECT mutated FROM infra.os_production_guard WHERE marker = $1`,
        [fx.productionMarker],
      );
      assert.equal(guard.rows[0]!.mutated, false);

      const rows = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM infra.migration_manifests`);
      assert.equal(rows.rows[0]!.n, 1);
      void LEGACY_IMPORT_IMPL;
    } finally {
      await pool.end();
    }
  });

  test('ZN-0050-NEG', async () => {
    const fx = fixture();
    const service = new LegacyImportService(null);
    const missing = await service.rehearse({
      legacySourceCommit: fx.legacyCommit,
      subjects: fx.subjects,
      knownSubjects: fx.knownSubjects,
      realm: 'evaluation',
      productionMarker: fx.productionMarker,
    });
    assert.equal(missing.tag, 'Blocked');

    const live = await service.rehearse({
      legacySourceCommit: fx.legacyCommit,
      subjects: fx.subjects,
      knownSubjects: fx.knownSubjects,
      realm: 'live',
      productionMarker: fx.productionMarker,
    });
    assert.equal(live.tag, 'Denied');
    if (live.tag === 'Denied') assert.equal(live.reason, 'LIVE_REALM_FORBIDDEN');

    const secret = await service.rehearse({
      legacySourceCommit: 'password=super-secret-source-token',
      subjects: fx.subjects,
      knownSubjects: fx.knownSubjects,
      realm: 'evaluation',
      productionMarker: fx.productionMarker,
    });
    assert.equal(secret.tag, 'Denied');
    if (secret.tag === 'Denied') assert.equal(secret.reason, 'FORBIDDEN_PAYLOAD');
  });

  test('ZN-0050-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await reset(pool);
      const store = pgStore(pool);
      const service = new LegacyImportService(store);

      const base = {
        legacySourceCommit: fx.legacyCommit,
        subjects: fx.subjects,
        knownSubjects: fx.knownSubjects,
        realm: 'evaluation' as const,
        productionMarker: fx.productionMarker,
      };
      const a = await service.rehearse(base);
      const b = await service.rehearse({
        ...base,
        subjects: [...fx.subjects].reverse(),
      });
      assert.equal(a.tag, 'Ok');
      assert.equal(b.tag, 'Ok');
      if (a.tag === 'Ok' && b.tag === 'Ok') {
        assert.deepEqual(a.value.rowCounts, b.value.rowCounts);
        assert.deepEqual(a.value.unmatchedRecords, b.value.unmatchedRecords);
        assert.deepEqual(a.value.semanticDiffs, b.value.semanticDiffs);
        assert.equal(a.value.administratorAutoGranted, false);
        assert.equal(b.value.administratorAutoGranted, false);
      }

      // Profile limit → Unsupported rather than silent truncation
      const over = await service.rehearse({
        ...base,
        profileSubjectLimit: 1,
      });
      assert.equal(over.tag, 'Unsupported');
      if (over.tag === 'Unsupported') assert.equal(over.reason, 'PROFILE_LIMIT');

      // Production still untouched after duplicate rehearsals
      const guard = await pool.query<{ mutated: boolean; n: number }>(
        `SELECT mutated, count(*)::int AS n FROM infra.os_production_guard WHERE marker = $1 GROUP BY mutated`,
        [fx.productionMarker],
      );
      assert.equal(guard.rows[0]!.mutated, false);
    } finally {
      await pool.end();
    }
  });
}

await registerZn0050Tests();
