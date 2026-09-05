import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0047-redaction-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-008/redaction.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-008/redaction.schema.json');
const SQLS = ['db/migrations/zn-0047_redaction.sql'].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0047-emit-${process.pid}`);
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
  caseId: string;
  clinicalNote: string;
  sourceCredential: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

async function resetAudit(pool: pg.Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS audit CASCADE`);
  for (const sql of SQLS) {
    if (existsSync(sql)) await pool.query(readFileSync(sql, 'utf8'));
  }
}

async function registerZn0047Tests(): Promise<void> {
  const { RedactionService, secretContentScan, REDACTION_IMPL } = await import(
    '../../../.core-build/packages/telemetry/src/redaction.js'
  );
  type Redacted = {
    eventId: string;
    kind: string;
    retentionClass: string;
    correlation: { caseIdHash: string | null; traceId: string };
    operation: string;
    result: string;
    attributes: Record<string, unknown>;
  };

  test('ZN-0047-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const recorded: Redacted[] = [];
    try {
      await resetAudit(pool);
      const sink = {
        async append(event: Redacted) {
          recorded.push(event);
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
      };
      const service = new RedactionService(sink);

      // Every logging path records the failure (operational + security + metric attempts)
      const paths = [
        {
          kind: 'request.failed' as const,
          operation: 'OpenEvidence',
          result: 'Denied',
          caseId: fx.caseId,
          worldId: randomUUID(),
          message: fx.sourceCredential,
          attributes: {
            errorCode: 'NOT_FOUND_OR_DENIED',
            credential: fx.sourceCredential,
            clinicalNote: fx.clinicalNote,
            password: 'should-never-appear',
            transport: 'web',
          },
        },
        {
          kind: 'security.audit' as const,
          operation: 'OpenEvidence',
          result: 'Denied',
          caseId: fx.caseId,
          attributes: { errorCode: 'NOT_FOUND_OR_DENIED', resultTag: 'Denied' },
        },
        {
          kind: 'operator.metric' as const,
          operation: 'OpenEvidence',
          result: 'Denied',
          caseId: fx.caseId,
          attributes: { durationMs: 12, transport: 'cli' },
        },
      ];

      for (const raw of paths) {
        const out = await service.recordFailure(raw);
        assert.equal(out.tag, 'Ok', JSON.stringify(out));
      }
      assert.equal(recorded.length, 3);

      const scans = secretContentScan(recorded, fx.clinicalNote, fx.sourceCredential);
      assert.deepEqual(scans, []);
      // Case still traceable via hash
      const caseHash = createHash('sha256')
        .update(`${REDACTION_IMPL}|case|${fx.caseId}`, 'utf8')
        .digest('hex');
      assert.ok(recorded.some((e) => e.correlation.caseIdHash === caseHash));
      // Raw case id absent
      for (const e of recorded) {
        const blob = JSON.stringify(e);
        assert.equal(blob.includes(fx.caseId), false);
        assert.equal(blob.includes(fx.clinicalNote), false);
        assert.equal(blob.includes(fx.sourceCredential), false);
        assert.equal(blob.toLowerCase().includes('password'), false);
      }

      const rows = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit.operational_events`);
      assert.equal(rows.rows[0]!.n, 3);
    } finally {
      await pool.end();
    }
  });

  test('ZN-0047-NEG', async () => {
    const fx = fixture();
    const service = new RedactionService(null);
    // Attempt to include secrets / restore without allowlisted sink deps => fail safely
    const denied = service.redact({
      operation: '',
      result: 'Denied',
      attributes: { credential: fx.sourceCredential },
    });
    assert.equal(denied.tag, 'Denied');
    if (denied.tag === 'Denied') assert.equal(denied.reason, 'INVALID_INPUT');

    // Export with unsupported scope
    const badScope = service.exportForScope('all-the-things' as never, []);
    assert.equal(badScope.tag, 'Denied');
    if (badScope.tag === 'Denied') assert.equal(badScope.reason, 'UNSUPPORTED_SCOPE');
  });

  test('ZN-0047-BOUNDARY', async () => {
    const fx = fixture();
    const service = new RedactionService(null);
    const events = [];
    for (const kind of ['request.failed', 'security.audit', 'operator.metric'] as const) {
      const out = service.redact({
        kind,
        operation: 'Inspect',
        result: 'Ok',
        caseId: fx.caseId,
        attributes: { transport: 'web', durationMs: 1 },
      });
      assert.equal(out.tag, 'Ok');
      if (out.tag === 'Ok') events.push(out.value);
    }
    // Duplicate / reordered export
    const auditA = service.exportForScope('security-audit', events);
    const auditB = service.exportForScope('security-audit', [...events].reverse());
    assert.equal(auditA.tag, 'Ok');
    assert.equal(auditB.tag, 'Ok');
    if (auditA.tag === 'Ok' && auditB.tag === 'Ok') {
      assert.ok(auditA.value.every((e) => e.kind === 'security.audit' || e.retentionClass === 'security-audit'));
      assert.equal(auditA.value.length, auditB.value.length);
    }
    const metrics = service.exportForScope('operator-metrics', events);
    assert.equal(metrics.tag, 'Ok');
    if (metrics.tag === 'Ok') {
      assert.ok(metrics.value.every((e) => e.kind !== 'security.audit' && e.retentionClass !== 'security-audit'));
      // security audit must not leak into operator metrics
      assert.equal(metrics.value.some((e) => e.kind === 'security.audit'), false);
    }

    // Profile limit: oversized attribute values omitted rather than silent truncate-as-complete secret
    const oversized = service.redact({
      operation: 'Inspect',
      result: 'Ok',
      attributes: { transport: 'web', errorCode: 'x'.repeat(500) },
    });
    assert.equal(oversized.tag, 'Ok');
    if (oversized.tag === 'Ok') {
      assert.equal(oversized.value.attributes.errorCode, undefined);
      assert.equal(oversized.value.attributes.transport, 'web');
    }
  });
}

await registerZn0047Tests();
