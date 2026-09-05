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
const FIXTURE_SEED = 'zn-0029-capture-gc-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-004/capture-gc.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-004/capture-gc.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0025_capture.sql',
  'db/migrations/zn-0026_admission.sql',
  'db/migrations/zn-0027_evidence-read.sql',
  'db/migrations/zn-0028_extract.sql',
  'db/migrations/zn-0029_capture-gc.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0029-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/evidence/evidence-read.ts'),
        join(ROOT, 'packages/ontology/src/evidence/extract.ts'),
        join(ROOT, 'packages/ontology/src/evidence/capture-gc.ts'),
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

async function registerZn0029Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { CaptureStager, isStaged } = await import(
    '../../../.core-build/packages/ontology/src/evidence/capture.js'
  );
  const { CaptureAdmission } = await import(
    '../../../.core-build/packages/ontology/src/evidence/admission.js'
  );
  const { CaptureGarbageCollector } = await import(
    '../../../.core-build/packages/ontology/src/evidence/capture-gc.js'
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

  test('ZN-0029-AC', async () => {
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
      const gc = new CaptureGarbageCollector(db, store, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });

        // Capture A: will be admitted while racing GC near lease expiry — must survive
        const a = await stager.stageCapture(binding, new TextEncoder().encode('a,b\n1,2\n'), {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'race-admit',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(a));
        if (!isStaged(a)) throw new Error('stage');
        const past = new Date(Date.now() - 1000).toISOString();
        await pool.query(
          `UPDATE ontology.captures
           SET upload_lease_expires_at=$3::timestamptz, pending_admission=true
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, a.captureId, past],
        );

        // Capture B: expired orphan, no pin, no pending — deletable
        const b = await stager.stageCapture(binding, new TextEncoder().encode('x,y\n9,9\n'), {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'orphan',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(b));
        if (!isStaged(b)) throw new Error('stage');
        await pool.query(
          `UPDATE ontology.captures
           SET upload_lease_expires_at=$3::timestamptz, pending_admission=false
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, b.captureId, past],
        );

        // Race: GC vs admission contending for capture A near lease expiry.
        // pending_admission remains true until admission commits, so GC rechecks and skips.
        const now = new Date().toISOString();
        const raced = await Promise.all([
          (async () => {
            const receipt = await admission.admitCapture({
              world: binding.world,
              bindingId: binding.bindingId,
              captureId: a.captureId,
              mappingDigest: fx.mappingDigest,
              operationId: uuid(randomUUID()),
              principalId: uuid(seeded.principalId),
              rightsRef: 'rights:owner',
              retentionRef: 'retention:standard',
              domainId: fx.domain,
              predicateId: fx.predicate,
              subjectLabel: 'race-admit',
            });
            await pool.query(
              `UPDATE ontology.captures SET pending_admission=false
               WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
              [seeded.worldId, a.captureId],
            );
            return receipt;
          })(),
          gc.collectOrphan({ world: binding.world, captureId: a.captureId, nowIso: now }),
        ]);

        const admitResult = raced[0];
        const gcA = raced[1];
        assert.ok(admitResult.evidenceId);
        assert.equal(gcA.tag, 'Skipped', `admitted/pending capture must survive GC: ${JSON.stringify(gcA)}`);
        if (gcA.tag === 'Skipped') {
          assert.ok(
            gcA.reason === 'skipped_pending' || gcA.reason === 'skipped_admitted',
            gcA.reason,
          );
        }

        // Pin the admitted capture historically
        await gc.pinCapture({
          world: binding.world,
          captureId: a.captureId,
          kind: 'historical',
        });
        const pinnedGc = await gc.collectOrphan({
          world: binding.world,
          captureId: a.captureId,
          nowIso: new Date().toISOString(),
        });
        assert.equal(pinnedGc.tag, 'Skipped');
        if (pinnedGc.tag === 'Skipped') {
          assert.ok(
            pinnedGc.reason === 'skipped_pinned' || pinnedGc.reason === 'skipped_admitted',
            pinnedGc.reason,
          );
        }
        // Explicit pin path: stage a third capture, pin without admitting, GC must skip_pinned
        const c = await stager.stageCapture(binding, new TextEncoder().encode('p,i\nn,1\n'), {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'pinned-only',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(c));
        if (!isStaged(c)) throw new Error('stage');
        await pool.query(
          `UPDATE ontology.captures
           SET upload_lease_expires_at=$3::timestamptz, pending_admission=false
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, c.captureId, past],
        );
        await gc.pinCapture({ world: binding.world, captureId: c.captureId, kind: 'admission' });
        const pinOnly = await gc.collectOrphan({
          world: binding.world,
          captureId: c.captureId,
          nowIso: new Date().toISOString(),
        });
        assert.equal(pinOnly.tag, 'Skipped');
        if (pinOnly.tag === 'Skipped') assert.equal(pinOnly.reason, 'skipped_pinned');

        // Orphan B deleted
        const delB = await gc.collectOrphan({
          world: binding.world,
          captureId: b.captureId,
          nowIso: new Date().toISOString(),
        });
        assert.equal(delB.tag, 'Deleted');

        // No evidence points at GC-deleted bytes
        const dangling = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n
           FROM ontology.evidence e
           JOIN ontology.source_admissions sa
             ON sa.world_id=e.world_id AND sa.realm=e.realm AND sa.evidence_id=e.evidence_id
           JOIN ontology.captures c
             ON c.world_id=sa.world_id AND c.realm=sa.realm AND c.capture_id=sa.capture_id
           WHERE e.world_id=$1::uuid AND c.gc_deleted_at IS NOT NULL`,
          [seeded.worldId],
        );
        assert.equal(dangling.rows[0]?.n, 0);

        const surviving = await pool.query<{ state: string; gc_deleted_at: string | null }>(
          `SELECT state, gc_deleted_at::text FROM ontology.captures
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, a.captureId],
        );
        assert.equal(surviving.rows[0]?.state, 'admitted');
        assert.equal(surviving.rows[0]?.gc_deleted_at, null);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0029-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const gc = new CaptureGarbageCollector(db, store, testCrypto);
      try {
        const world = Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const });
        // Wrong-World / missing capture
        const missing = await gc.collectOrphan({
          world: Object.freeze({ worldId: uuid(randomUUID()), realm: 'live' as const }),
          captureId: uuid(randomUUID()),
          nowIso: new Date().toISOString(),
        });
        assert.equal(missing.tag, 'Skipped');
        if (missing.tag === 'Skipped') assert.equal(missing.reason, 'not_found');

        const localMissing = await gc.collectOrphan({
          world,
          captureId: uuid(randomUUID()),
          nowIso: new Date().toISOString(),
        });
        assert.equal(localMissing.tag, 'Skipped');
        if (localMissing.tag === 'Skipped') assert.equal(localMissing.reason, 'not_found');

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

  test('ZN-0029-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const gc = new CaptureGarbageCollector(db, store, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'csv-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv']),
        });
        const staged = await stager.stageCapture(binding, new TextEncoder().encode('k,v\n1,1\n'), {
          sourceNamespace: fx.sourceNamespace,
          externalId: 'boundary-orphan',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(staged));
        if (!isStaged(staged)) throw new Error('stage');
        const past = new Date(Date.now() - 5000).toISOString();
        await pool.query(
          `UPDATE ontology.captures
           SET upload_lease_expires_at=$3::timestamptz, pending_admission=false
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, staged.captureId, past],
        );

        // Concurrent GC — at most one delete semantic result
        const now = new Date().toISOString();
        const raced = await Promise.all([
          gc.collectOrphan({ world: binding.world, captureId: staged.captureId, nowIso: now }),
          gc.collectOrphan({ world: binding.world, captureId: staged.captureId, nowIso: now }),
        ]);
        assert.equal(raced.filter((r) => r.tag === 'Deleted').length >= 1, true);
        const deletedFlags = raced.filter((r) => r.tag === 'Deleted') as Array<{
          tag: 'Deleted';
          alreadyDeleted: boolean;
        }>;
        assert.equal(deletedFlags.filter((r) => r.alreadyDeleted === false).length, 1);

        const row = await pool.query<{ gc_deleted_at: string | null; blob_ref: string | null }>(
          `SELECT gc_deleted_at::text, blob_ref FROM ontology.captures
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, staged.captureId],
        );
        assert.ok(row.rows[0]?.gc_deleted_at);
        assert.equal(row.rows[0]?.blob_ref, null);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });
}

await registerZn0029Tests();
