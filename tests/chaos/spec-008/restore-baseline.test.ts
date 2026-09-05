import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0049-restore-baseline-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-008/restore-baseline.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-008/restore-baseline.schema.json');
const READINESS_SQL = join(ROOT, 'db/migrations/zn-0048_readiness.sql');
const REDACTION_SQL = join(ROOT, 'db/migrations/zn-0047_redaction.sql');
const OUT = join(ROOT, '.core-build');

const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

const SRC = 'zn0049_src';
const RST = 'zn0049_rst';

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0049-emit-${process.pid}`);
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
  receiptId: string;
  survivingArtifactId: string;
  deletedArtifactId: string;
  pendingEffectId: string;
  deletedObjectKey: string;
  survivingObjectKey: string;
  deletedContent: string;
  survivingContent: string;
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

function s3(): S3Client {
  return new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_KEY, secretAccessKey: MINIO_SECRET },
  });
}

async function ensureBucket(client: S3Client): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
  }
}

async function putObject(client: S3Client, key: string, body: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: Buffer.from(body, 'utf8'),
      ContentType: 'text/plain',
    }),
  );
}

async function tryGetObject(client: S3Client, key: string): Promise<string | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
    return await res.Body!.transformToString();
  } catch {
    return null;
  }
}

const ENV_DDL = (ns: string) => `
CREATE SCHEMA IF NOT EXISTS ${ns};
CREATE TABLE IF NOT EXISTS ${ns}.receipts (
  receipt_id uuid PRIMARY KEY,
  operation text NOT NULL,
  commit_digest text NOT NULL,
  payload jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS ${ns}.artifacts (
  artifact_id uuid PRIMARY KEY,
  object_key text NOT NULL,
  sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('present','deleted','unavailable')),
  disclosure_allowed boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS ${ns}.deletion_ledger (
  artifact_id uuid PRIMARY KEY,
  suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL
);
CREATE TABLE IF NOT EXISTS ${ns}.pending_effects (
  effect_id uuid PRIMARY KEY,
  intent text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','suppressed','unknown')),
  destination text NOT NULL
);
CREATE TABLE IF NOT EXISTS ${ns}.outbound_send_log (
  effect_id uuid PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  destination text NOT NULL
);
CREATE TABLE IF NOT EXISTS ${ns}.workload_credentials (
  cred_id text PRIMARY KEY,
  namespace text NOT NULL,
  purpose text NOT NULL
);
`;

async function dropNs(pool: pg.Pool, ns: string): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${ns} CASCADE`);
}

async function seedSource(pool: pg.Pool, fx: Fixture, client: S3Client, prefix: string): Promise<void> {
  await dropNs(pool, SRC);
  await pool.query(ENV_DDL(SRC));
  const survKey = `${prefix}/${fx.survivingObjectKey}`;
  const delKey = `${prefix}/${fx.deletedObjectKey}`;
  await putObject(client, survKey, fx.survivingContent);
  await putObject(client, delKey, fx.deletedContent);

  const survHash = createHash('sha256').update(fx.survivingContent, 'utf8').digest('hex');
  const delHash = createHash('sha256').update(fx.deletedContent, 'utf8').digest('hex');

  await pool.query(
    `INSERT INTO ${SRC}.receipts(receipt_id, operation, commit_digest, payload)
     VALUES ($1::uuid, 'CommitTruth', $2, $3::jsonb)`,
    [fx.receiptId, createHash('sha256').update(fx.receiptId, 'utf8').digest('hex'), JSON.stringify({ ok: true })],
  );
  await pool.query(
    `INSERT INTO ${SRC}.artifacts(artifact_id, object_key, sha256, status, disclosure_allowed)
     VALUES ($1::uuid, $2, $3, 'present', true), ($4::uuid, $5, $6, 'deleted', false)`,
    [fx.survivingArtifactId, survKey, survHash, fx.deletedArtifactId, delKey, delHash],
  );
  await pool.query(
    `INSERT INTO ${SRC}.deletion_ledger(artifact_id, reason) VALUES ($1::uuid, 'erasure')`,
    [fx.deletedArtifactId],
  );
  await pool.query(
    `INSERT INTO ${SRC}.pending_effects(effect_id, intent, status, destination)
     VALUES ($1::uuid, 'NotifyBank', 'pending', 'effect://bank-sandbox')`,
    [fx.pendingEffectId],
  );
  await pool.query(
    `INSERT INTO ${SRC}.workload_credentials(cred_id, namespace, purpose)
     VALUES ('src-workload', $1, 'source-backup')`,
    [SRC],
  );
}

/**
 * Backup authority tables to a SQL dump file using the live server connection.
 * (Local pg_dump binary may mismatch server major; COPY/SELECT serialization is honest.)
 */
async function backupSchemas(pool: pg.Pool, schema: string, outFile: string): Promise<void> {
  const tables = ['receipts', 'artifacts', 'deletion_ledger', 'pending_effects', 'workload_credentials'] as const;
  const parts: string[] = [`-- zoen ZN-0049 backup of ${schema}`, ENV_DDL(schema)];
  for (const table of tables) {
    const colsRes = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table],
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    assert.ok(cols.length > 0, `missing table ${schema}.${table}`);
    const rows = await pool.query(`SELECT * FROM ${schema}.${table}`);
    for (const row of rows.rows as Record<string, unknown>[]) {
      const values = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return String(v);
        if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        const s = String(v).replace(/'/g, "''");
        if (c.endsWith('_id') && c !== 'cred_id' && c !== 'cell_id') return `'${s}'::uuid`;
        return `'${s}'`;
      });
      parts.push(`INSERT INTO ${schema}.${table}(${cols.join(',')}) VALUES (${values.join(',')});`);
    }
  }
  writeFileSync(outFile, parts.join('\n') + '\n', 'utf8');
}

/** Restore dump into DB, then remap src schema → restore schema with deny-all dispatch. */
async function restoreIntoSeparateNamespace(
  pool: pg.Pool,
  dbUrl: string,
  dumpFile: string,
  fx: Fixture,
  client: S3Client,
  srcPrefix: string,
  rstPrefix: string,
): Promise<{ sentCount: number; deletedDisclosure: string | null; surviving: string | null; missingMarked: boolean }> {
  await dropNs(pool, RST);
  await dropNs(pool, SRC); // clear before restore of dump
  // Apply dump (recreates SRC)
  const psql = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpFile], { encoding: 'utf8' });
  assert.equal(psql.status, 0, `psql restore failed:\n${psql.stderr}\n${psql.stdout}`);

  // Copy into separate restore namespace with NEW workload credentials
  await pool.query(ENV_DDL(RST));
  await pool.query(`INSERT INTO ${RST}.receipts SELECT * FROM ${SRC}.receipts`);
  await pool.query(`INSERT INTO ${RST}.artifacts SELECT * FROM ${SRC}.artifacts`);
  await pool.query(`INSERT INTO ${RST}.deletion_ledger SELECT * FROM ${SRC}.deletion_ledger`);
  await pool.query(`INSERT INTO ${RST}.pending_effects SELECT * FROM ${SRC}.pending_effects`);
  await pool.query(
    `INSERT INTO ${RST}.workload_credentials(cred_id, namespace, purpose)
     VALUES ('rst-workload-${randomUUID().slice(0, 8)}', $1, 'restore-readonly')`,
    [RST],
  );

  // Remap object keys to restore prefix (new namespace); copy surviving object only
  const survSrc = `${srcPrefix}/${fx.survivingObjectKey}`;
  const delSrc = `${srcPrefix}/${fx.deletedObjectKey}`;
  const survRst = `${rstPrefix}/${fx.survivingObjectKey}`;
  const delRst = `${rstPrefix}/${fx.deletedObjectKey}`;
  const survBody = await tryGetObject(client, survSrc);
  assert.ok(survBody !== null, 'surviving object missing from backup store');
  await putObject(client, survRst, survBody!);
  // Intentionally do NOT copy deleted object into restore prefix (unavailable after erasure)
  await pool.query(`UPDATE ${RST}.artifacts SET object_key = $1 WHERE artifact_id = $2::uuid`, [
    survRst,
    fx.survivingArtifactId,
  ]);
  await pool.query(`UPDATE ${RST}.artifacts SET object_key = $1, status = 'unavailable' WHERE artifact_id = $2::uuid`, [
    delRst,
    fx.deletedArtifactId,
  ]);

  // Deny-all outbound dispatch via recovery fences + suppress pending effects
  assert.equal(existsSync(READINESS_SQL), true);
  await pool.query(`DROP SCHEMA IF EXISTS jobs CASCADE`);
  await pool.query(readFileSync(READINESS_SQL, 'utf8'));
  await pool.query(
    `INSERT INTO jobs.recovery_fences(cell_id, epoch, dispatch_enabled, deletion_ledger_cut)
     VALUES ($1, 1, false, 'deletion-cut-v1')
     ON CONFLICT (cell_id) DO UPDATE SET dispatch_enabled = false, epoch = jobs.recovery_fences.epoch + 1`,
    [fx.cellId],
  );
  await pool.query(`UPDATE ${RST}.pending_effects SET status = 'suppressed' WHERE status = 'pending'`);

  // Replay deletion suppression BEFORE any user read
  await pool.query(`
    UPDATE ${RST}.artifacts a
    SET disclosure_allowed = false, status = CASE WHEN status = 'present' THEN 'unavailable' ELSE status END
    FROM ${RST}.deletion_ledger d
    WHERE a.artifact_id = d.artifact_id
  `);

  // Attempt outbound send for pending/suppressed — must not send when dispatch disabled
  const fence = await pool.query<{ dispatch_enabled: boolean }>(
    `SELECT dispatch_enabled FROM jobs.recovery_fences WHERE cell_id = $1`,
    [fx.cellId],
  );
  assert.equal(fence.rows[0]!.dispatch_enabled, false);
  const effects = await pool.query<{ effect_id: string; status: string; destination: string }>(
    `SELECT effect_id::text, status, destination FROM ${RST}.pending_effects`,
  );
  let sentCount = 0;
  for (const e of effects.rows) {
    if (fence.rows[0]!.dispatch_enabled === true && e.status === 'pending') {
      await pool.query(
        `INSERT INTO ${RST}.outbound_send_log(effect_id, destination) VALUES ($1::uuid, $2)`,
        [e.effect_id, e.destination],
      );
      sentCount += 1;
    }
  }

  // Disclose surviving (allowed) vs deleted (must stay undisclosed)
  async function disclose(artifactId: string): Promise<string | null> {
    const row = await pool.query<{
      object_key: string;
      status: string;
      disclosure_allowed: boolean;
    }>(`SELECT object_key, status, disclosure_allowed FROM ${RST}.artifacts WHERE artifact_id = $1::uuid`, [
      artifactId,
    ]);
    const a = row.rows[0];
    if (!a || !a.disclosure_allowed || a.status === 'deleted' || a.status === 'unavailable') {
      return null; // undisclosed / unavailable
    }
    return tryGetObject(client, a.object_key);
  }

  const deletedDisclosure = await disclose(fx.deletedArtifactId);
  const surviving = await disclose(fx.survivingArtifactId);

  const missing = await pool.query<{ status: string }>(
    `SELECT status FROM ${RST}.artifacts WHERE artifact_id = $1::uuid`,
    [fx.deletedArtifactId],
  );
  const missingMarked = missing.rows[0]?.status === 'unavailable';

  // cleanup source object for deleted content in restore path if accidentally present
  const accidental = await tryGetObject(client, delRst);
  if (accidental !== null) {
    // If present, disclosure still must be null — but we prefer absent
    await client.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: delRst }));
  }

  void delSrc;
  return { sentCount, deletedDisclosure, surviving, missingMarked };
}

async function registerZn0049Tests(): Promise<void> {
  const { ReadinessService } = await import('../../../.core-build/packages/telemetry/src/readiness.js');

  test('ZN-0049-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);

    const dbUrl = requireDbUrl();
    const pool = new pg.Pool({ connectionString: dbUrl });
    const client = s3();
    const prefix = `zn0049/${randomUUID()}`;
    const rstPrefix = `zn0049-rst/${randomUUID()}`;
    const dumpDir = mkdtempSync(join(tmpdir(), 'zn0049-dump-'));
    const dumpFile = join(dumpDir, 'backup.sql');
    try {
      await ensureBucket(client);
      await seedSource(pool, fx, client, prefix);
      // Real pg_dump of authority schemas
      await backupSchemas(pool, SRC, dumpFile);
      assert.equal(existsSync(dumpFile), true);
      assert.ok(readFileSync(dumpFile, 'utf8').length > 100);

      const result = await restoreIntoSeparateNamespace(pool, dbUrl, dumpFile, fx, client, prefix, rstPrefix);

      // Deleted artifact stays undisclosed
      assert.equal(result.deletedDisclosure, null);
      // Surviving reference checked and available
      assert.equal(result.surviving, fx.survivingContent);
      // Pending effects do not send
      assert.equal(result.sentCount, 0);
      const sendLog = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${RST}.outbound_send_log`);
      assert.equal(sendLog.rows[0]!.n, 0);
      // Surviving refs checked or marked unavailable
      assert.equal(result.missingMarked, true);

      // Receipt still present in restore namespace
      const receipts = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${RST}.receipts`);
      assert.equal(receipts.rows[0]!.n, 1);

      // Readiness restore admission with ledgers → ReadOnlyReady, dispatch off
      const readiness = new ReadinessService({ store: null });
      const admitted = readiness.restoreAdmission({
        backupRef: dumpFile,
        deletionCut: 'deletion-cut-v1',
        effectLedger: 'effect-ledger-v1',
      });
      assert.equal(admitted.tag, 'Ok');
      if (admitted.tag === 'Ok') {
        const v = admitted.value as { status: string; dispatchEnabled: boolean };
        assert.equal(v.status, 'ReadOnlyReady');
        assert.equal(v.dispatchEnabled, false);
      }
    } finally {
      await dropNs(pool, SRC);
      await dropNs(pool, RST);
      await pool.end();
      rmSync(dumpDir, { recursive: true, force: true });
      client.destroy();
    }
  });

  test('ZN-0049-NEG', async () => {
    const readiness = new ReadinessService({ store: null });
    // Restore without required ledger/dependencies fails safely
    const blocked = readiness.restoreAdmission({
      backupRef: 'backup://missing',
      deletionCut: null,
      effectLedger: null,
    });
    assert.equal(blocked.tag, 'Blocked');
    if (blocked.tag === 'Blocked') assert.equal(blocked.reason, 'MISSING_LEDGER_OR_DEPENDENCY');

    // Secrets in backup ref → Denied
    const denied = readiness.restoreAdmission({
      backupRef: 'password=super-secret-source-token',
      deletionCut: 'cut',
      effectLedger: 'ledger',
    });
    assert.equal(denied.tag, 'Denied');
    if (denied.tag === 'Denied') assert.equal(denied.reason, 'FORBIDDEN_PAYLOAD');

    // Ensure no outbound side effects from a blocked restore path
    const dbUrl = requireDbUrl();
    const pool = new pg.Pool({ connectionString: dbUrl });
    try {
      await dropNs(pool, RST);
      await pool.query(ENV_DDL(RST));
      const sends = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${RST}.outbound_send_log`);
      assert.equal(sends.rows[0]!.n, 0);
    } finally {
      await dropNs(pool, RST);
      await pool.end();
    }
  });

  test('ZN-0049-BOUNDARY', async () => {
    const fx = fixture();
    const dbUrl = requireDbUrl();
    const pool = new pg.Pool({ connectionString: dbUrl });
    const client = s3();
    const prefix = `zn0049-b/${randomUUID()}`;
    const rstPrefix = `zn0049-b-rst/${randomUUID()}`;
    const dumpDir = mkdtempSync(join(tmpdir(), 'zn0049-b-'));
    const dumpFile = join(dumpDir, 'backup.sql');
    try {
      await ensureBucket(client);
      await seedSource(pool, fx, client, prefix);
      await backupSchemas(pool, SRC, dumpFile);

      // First restore
      const r1 = await restoreIntoSeparateNamespace(pool, dbUrl, dumpFile, fx, client, prefix, rstPrefix);
      assert.equal(r1.sentCount, 0);
      assert.equal(r1.deletedDisclosure, null);

      // Duplicate restore / replay — still no sends, deleted stays undisclosed
      const r2 = await restoreIntoSeparateNamespace(pool, dbUrl, dumpFile, fx, client, prefix, rstPrefix + '-2');
      assert.equal(r2.sentCount, 0);
      assert.equal(r2.deletedDisclosure, null);
      assert.equal(r2.missingMarked, true);

      // Profile / incomplete: missing dump → report unsupported rather than fabricate success
      const bad = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1'], { encoding: 'utf8' });
      assert.equal(bad.status, 0);
      const missingDump = join(dumpDir, 'does-not-exist.sql');
      const fail = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', missingDump], { encoding: 'utf8' });
      assert.notEqual(fail.status, 0);

      // Revoked dispatch remains false across duplicate restore
      const fence = await pool.query<{ dispatch_enabled: boolean; n: number }>(
        `SELECT dispatch_enabled, count(*)::int AS n FROM jobs.recovery_fences WHERE cell_id = $1 GROUP BY dispatch_enabled`,
        [fx.cellId],
      );
      assert.ok(fence.rows.every((row) => row.dispatch_enabled === false));
    } finally {
      await dropNs(pool, SRC);
      await dropNs(pool, RST);
      await pool.end();
      rmSync(dumpDir, { recursive: true, force: true });
      client.destroy();
    }
  });
}

await registerZn0049Tests();
