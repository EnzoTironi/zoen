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
  CreateBucketCommand,
  PutBucketVersioningCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0026-admission-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-004/admission.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-004/admission.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0025_capture.sql',
  'db/migrations/zn-0026_admission.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0026-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/evidence/admission.ts'),
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
  domain: string;
  predicate: string;
  mappingDigest: string;
  maxBytes: number;
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
    async readImmutable() {
      throw new Error('unused');
    },
  };
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

async function registerZn0026Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { CaptureStager, isStaged } = await import(
    '../../../.core-build/packages/ontology/src/evidence/capture.js'
  );
  const { CaptureAdmission } = await import(
    '../../../.core-build/packages/ontology/src/evidence/admission.js'
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
    const worldId = genesis.value.worldId;
    const bindingId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.domains(world_id,realm,domain_id,version)
       VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`,
      [worldId, fx.domain],
    );
    await pool.query(
      `INSERT INTO ontology.source_bindings(world_id,realm,binding_id,definition_id,state,max_bytes,allowed_media_types)
       VALUES ($1::uuid,'live',$2::uuid,'csv-upload','active',$3,ARRAY['text/csv'])`,
      [worldId, bindingId, fx.maxBytes],
    );
    return { principalId, worldId, bindingId };
  }

  test('ZN-0026-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const bytesA = new TextEncoder().encode('id,val\n1,a\n');
        const bytesB = new TextEncoder().encode('id,val\n1,ALTERED\n');

        const c1 = await stager.stageCapture(binding, bytesA, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'row-1',
          revision: 'rev-1',
          declaredMediaType: 'text/csv',
        });
        const c2 = await stager.stageCapture(binding, bytesA, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'row-1',
          revision: 'rev-1',
          declaredMediaType: 'text/csv',
        });
        // Third delivery with altered bytes — distinct capture identity via digest
        const c3 = await stager.stageCapture(binding, bytesB, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'row-1',
          revision: 'rev-1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(c1) && isStaged(c2) && isStaged(c3));
        if (!isStaged(c1) || !isStaged(c2) || !isStaged(c3)) throw new Error('stage');
        assert.equal(c1.digest, c2.digest);
        assert.notEqual(c1.digest, c3.digest);

        const baseInput = {
          world: binding.world,
          bindingId: binding.bindingId,
          mappingDigest: fx.mappingDigest,
          principalId: uuid(seeded.principalId),
          rightsRef: 'rights:owner',
          retentionRef: 'retention:standard',
          domainId: fx.domain,
          predicateId: fx.predicate,
          subjectLabel: 'row-1',
        };

        // Concurrent identical admissions (same source revision + bytes)
        const identical = await Promise.all([
          admission.admitCapture({ ...baseInput, captureId: c1.captureId, operationId: uuid(randomUUID()) }),
          admission.admitCapture({ ...baseInput, captureId: c2.captureId, operationId: uuid(randomUUID()) }),
        ]);
        assert.equal(identical[0].evidenceId, identical[1].evidenceId);
        assert.equal(identical.filter((r) => r.firstAdmission).length, 1);

        // Altered bytes for same external revision → Conflict, never overwrite
        let anomaly = false;
        try {
          await admission.admitCapture({
            ...baseInput,
            captureId: c3.captureId,
            operationId: uuid(randomUUID()),
          });
        } catch (error: unknown) {
          anomaly = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error
              ? (error as { tag: string }).tag
              : '',
            'Conflict',
          );
        }
        assert.equal(anomaly, true);

        const evidenceCount = await pool.query<{ n: number; digest: string }>(
          `SELECT count(*)::int AS n, max(content_digest) AS digest
           FROM ontology.evidence WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(evidenceCount.rows[0]?.n, 1);
        assert.equal(evidenceCount.rows[0]?.digest, c1.digest);

        const claimsCount = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.claims WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(claimsCount.rows[0]?.n, 1);

        // Replay identical capture → same receipt, not a silent overwrite
        const replay = await admission.admitCapture({
          ...baseInput,
          captureId: c1.captureId,
          operationId: uuid(randomUUID()),
        });
        assert.equal(replay.firstAdmission, false);
        assert.equal(replay.evidenceId, identical[0].evidenceId);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0026-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const staged = await stager.stageCapture(binding, new TextEncoder().encode('a,b\n1,2\n'), {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'neg',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(staged));
        if (!isStaged(staged)) throw new Error('stage');

        // Wrong-World ref
        let denied = false;
        try {
          await admission.admitCapture({
            world: Object.freeze({ worldId: uuid(randomUUID()), realm: 'live' as const }),
            bindingId: binding.bindingId,
            captureId: staged.captureId,
            mappingDigest: fx.mappingDigest,
            operationId: uuid(randomUUID()),
            principalId: uuid(seeded.principalId),
            rightsRef: 'rights:owner',
            retentionRef: 'retention:standard',
            domainId: fx.domain,
            predicateId: fx.predicate,
            subjectLabel: 'neg',
          });
        } catch (error: unknown) {
          denied = true;
          assert.equal(
            typeof error === 'object' && error && 'tag' in error ? (error as { tag: string }).tag : '',
            'NotFoundOrDenied',
          );
        }
        assert.equal(denied, true);

        const evidence = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(evidence.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0026-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const bytes = new TextEncoder().encode('k,v\n1,ok\n');
        const staged = await stager.stageCapture(binding, bytes, {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'boundary',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(staged));
        if (!isStaged(staged)) throw new Error('stage');

        const input = {
          world: binding.world,
          bindingId: binding.bindingId,
          captureId: staged.captureId,
          mappingDigest: fx.mappingDigest,
          principalId: uuid(seeded.principalId),
          rightsRef: 'rights:owner',
          retentionRef: 'retention:standard',
          domainId: fx.domain,
          predicateId: fx.predicate,
          subjectLabel: 'boundary',
        };

        const raced = await Promise.all([
          admission.admitCapture({ ...input, operationId: uuid(randomUUID()) }),
          admission.admitCapture({ ...input, operationId: uuid(randomUUID()) }),
        ]);
        assert.equal(raced[0].evidenceId, raced[1].evidenceId);
        assert.equal(raced.filter((r) => r.firstAdmission).length, 1);

        const admissions = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.source_admissions WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(admissions.rows[0]?.n, 1);
        const evidence = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(evidence.rows[0]?.n, 1);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });
}

await registerZn0026Tests();
