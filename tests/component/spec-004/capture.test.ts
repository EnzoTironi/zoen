import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0025-capture-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-004/capture.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-004/capture.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0025_capture.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0025-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/evidence/capture.ts'),
        join(ROOT, 'packages/ontology/src/evidence/types.ts'),
        join(ROOT, 'packages/ontology/src/evidence/ports.ts'),
        join(ROOT, 'packages/ontology/src/evidence/index.ts'),
        join(ROOT, 'packages/ontology/src/worlds/genesis.ts'),
        join(ROOT, 'packages/ontology/src/worlds/index.ts'),
        join(ROOT, 'packages/adapters/src/pg.ts'),
        join(ROOT, 'packages/contracts/src/ports.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
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
  sourceNamespace: string;
  maxBytes: number;
  csvMediaType: string;
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

async function ensureBucket(client: S3Client): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
  }
  await client.send(
    new PutBucketVersioningCommand({
      Bucket: MINIO_BUCKET,
      VersioningConfiguration: { Status: 'Enabled' },
    }),
  );
}

/** Real MinIO EvidenceStore for disposable harness (not a mock). */
function createMinioStore(crypto: { sha256(bytes: Uint8Array): Promise<string> }) {
  const client = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_KEY, secretAccessKey: MINIO_SECRET },
  });
  return {
    client,
    async putImmutable(world: { worldId: string; realm: string }, reference: string, bytes: Uint8Array, mediaType: string) {
      const sha256 = await crypto.sha256(bytes);
      const key = `${world.realm}/${world.worldId}/capture/${reference}/${sha256}`;
      const result = await client.send(
        new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: mediaType,
          ContentLength: bytes.byteLength,
          Metadata: { sha256 },
        }),
      );
      if (!result.VersionId) throw new Error('MissingPrerequisite: MinIO versioning');
      return Object.freeze({
        key,
        sha256,
        size: String(bytes.byteLength),
        mediaType,
        versionId: result.VersionId,
      });
    },
    async readImmutable(artifact: { key: string; sha256: string; size: string; versionId: string }) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: artifact.key,
          VersionId: artifact.versionId,
        }),
      );
      const bytes = await response.Body!.transformToByteArray();
      return bytes;
    },
    async failPut() {
      /* used by injecting a broken store below */
    },
  };
}

async function registerZn0025Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { CaptureStager, isStaged, isQuarantined } = await import(
    '../../../.core-build/packages/ontology/src/evidence/capture.js'
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

  test('ZN-0025-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const storeWrap = createMinioStore(testCrypto);
    try {
      await ensureBucket(storeWrap.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId;
      const bindingId = randomUUID();
      await pool.query(
        `INSERT INTO ontology.source_bindings(world_id,realm,binding_id,definition_id,state,max_bytes,allowed_media_types)
         VALUES ($1::uuid,'live',$2::uuid,'csv-upload','active',$3,ARRAY['text/csv'])`,
        [worldId, bindingId, fx.maxBytes],
      );

      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, storeWrap, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(bindingId),
          world: Object.freeze({ worldId: uuid(worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });

        const csv = new TextEncoder().encode('a,b\n1,2\n');
        const ok = await stager.stageCapture(binding, csv, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'report-1',
          revision: 'v1',
          declaredMediaType: 'text/csv',
          declaredFileName: 'report.csv',
        });
        assert.equal(isStaged(ok), true);
        if (!isStaged(ok)) throw new Error('expected staged');

        const oversized = new Uint8Array(fx.maxBytes + 10).fill(65);
        const big = await stager.stageCapture(binding, oversized, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'big',
          revision: 'v1',
          declaredMediaType: 'text/csv',
          declaredFileName: 'big.csv',
        });
        assert.equal(isQuarantined(big), true);
        if (isQuarantined(big)) assert.equal(big.reason, 'SIZE_LIMIT');

        const archive = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
        const zip = await stager.stageCapture(binding, archive, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'zip',
          revision: 'v1',
          declaredMediaType: 'text/csv',
          declaredFileName: 'x.zip',
        });
        assert.equal(isQuarantined(zip), true);

        // Failed object-store upload
        const failingStore = {
          async putImmutable() {
            throw Object.assign(new Error('upload failed'), { code: 'OBJECT_STORE_FAILED' });
          },
          async readImmutable() {
            throw new Error('unreachable');
          },
        };
        const failStager = new CaptureStager(db, failingStore, testCrypto);
        const failed = await failStager.stageCapture(binding, csv, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'fail-upload',
          revision: 'v1',
          declaredMediaType: 'text/csv',
        });
        assert.equal(isQuarantined(failed), true);

        const staged = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.captures WHERE state='staged' AND world_id=$1::uuid`,
          [worldId],
        );
        assert.equal(staged.rows[0]?.n, 1);
        const evidence = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [worldId],
        );
        const claims = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.claims WHERE world_id=$1::uuid`,
          [worldId],
        );
        assert.equal(evidence.rows[0]?.n, 0);
        assert.equal(claims.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      storeWrap.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0025-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const storeWrap = createMinioStore(testCrypto);
    try {
      await ensureBucket(storeWrap.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId;
      const bindingId = randomUUID();
      await pool.query(
        `INSERT INTO ontology.source_bindings(world_id,realm,binding_id,definition_id,state,max_bytes,allowed_media_types)
         VALUES ($1::uuid,'live',$2::uuid,'csv-upload','active',$3,ARRAY['text/csv'])`,
        [worldId, bindingId, fx.maxBytes],
      );
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, storeWrap, testCrypto);
      try {
        const otherWorld = randomUUID();
        // Wrong-World binding identity: binding belongs to worldId but we pass other world ref
        const wrong = Object.freeze({
          bindingId: uuid(bindingId),
          world: Object.freeze({ worldId: uuid(otherWorld), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const csv = new TextEncoder().encode('a,b\n1,2\n');
        const result = await stager.stageCapture(wrong, csv, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'x',
          revision: 'v1',
          declaredMediaType: 'text/csv',
          declaredFileName: '../etc/passwd',
        });
        assert.equal(isQuarantined(result), true);

        const evidence = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence`,
        );
        assert.equal(evidence.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      storeWrap.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0025-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const storeWrap = createMinioStore(testCrypto);
    try {
      await ensureBucket(storeWrap.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId;
      const bindingId = randomUUID();
      await pool.query(
        `INSERT INTO ontology.source_bindings(world_id,realm,binding_id,definition_id,state,max_bytes,allowed_media_types)
         VALUES ($1::uuid,'live',$2::uuid,'csv-upload','active',$3,ARRAY['text/csv'])`,
        [worldId, bindingId, fx.maxBytes],
      );
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, storeWrap, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(bindingId),
          world: Object.freeze({ worldId: uuid(worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const csv = new TextEncoder().encode('id,name\n1,alpha\n');
        // Concurrent identical staging — each gets own captureId but durable bytes verified; no evidence
        const results = await Promise.all([
          stager.stageCapture(binding, csv, {
            sourceNamespace: fx.sourceNamespace,
            externalId: 'dup',
            revision: 'r1',
            declaredMediaType: 'text/csv',
          }),
          stager.stageCapture(binding, csv, {
            sourceNamespace: fx.sourceNamespace,
            externalId: 'dup',
            revision: 'r1',
            declaredMediaType: 'text/csv',
          }),
        ]);
        assert.ok(results.every(isStaged));
        const digests = new Set(results.filter(isStaged).map((r) => r.digest));
        assert.equal(digests.size, 1);
        const evidence = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [worldId],
        );
        assert.equal(evidence.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      storeWrap.client.destroy();
      await pool.end();
    }
  });
}

await registerZn0025Tests();
