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
  CreateBucketCommand,
  PutBucketVersioningCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0027-evidence-read-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-004/evidence-read.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-004/evidence-read.schema.json');
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
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0027-emit-${process.pid}`);
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
  retentionTtlSeconds: number;
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
    async readImmutable(artifact: { key: string; sha256: string; size: string; mediaType: string; versionId: string }) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: artifact.key,
          ...(artifact.versionId !== 'latest' ? { VersionId: artifact.versionId } : {}),
        }),
      );
      if (!response.Body) {
        const err = Object.assign(new Error('ARTIFACT_UNAVAILABLE'), { tag: 'HistoricalContentUnavailable' });
        throw err;
      }
      const bytes = await response.Body.transformToByteArray();
      const sha256 = await crypto.sha256(bytes);
      if (sha256 !== artifact.sha256 || String(bytes.byteLength) !== artifact.size) {
        const err = Object.assign(new Error('ARTIFACT_INTEGRITY'), { tag: 'Unavailable' });
        throw err;
      }
      return bytes;
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

function assertNoLocator(payload: unknown): void {
  const text = JSON.stringify(payload, (_k, v) => (v instanceof Uint8Array ? `[bytes:${v.byteLength}]` : v));
  assert.equal(/live\/[0-9a-f-]{36}\/capture\//i.test(text), false, `locator leaked: ${text}`);
  assert.equal(/"object_key"|"blob_ref"|"blobRef"|"storageKey"/i.test(text), false, `locator field: ${text}`);
}

async function registerZn0027Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { CaptureStager, isStaged } = await import(
    '../../../.core-build/packages/ontology/src/evidence/capture.js'
  );
  const { CaptureAdmission } = await import(
    '../../../.core-build/packages/ontology/src/evidence/admission.js'
  );
  const { EvidenceReader } = await import(
    '../../../.core-build/packages/ontology/src/evidence/evidence-read.js'
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

  async function issueGrant(
    pool: pg.Pool,
    worldId: string,
    principalId: string,
    purpose: string,
    expiresAt: Date,
    securityRevision = 0,
  ) {
    const grantHash = createHash('sha256')
      .update(`${worldId}|${principalId}|${purpose}|${expiresAt.toISOString()}|${securityRevision}`)
      .digest('hex');
    const audienceHash = createHash('sha256').update(principalId).digest('hex');
    await pool.query(
      `INSERT INTO ontology.grants(
         grant_hash, world_id, realm, principal_id, purpose, audience_hash,
         assurance, expires_at, security_revision
       ) VALUES ($1,$2::uuid,'live',$3::uuid,$4,$5,'presence',$6,$7)`,
      [grantHash, worldId, principalId, purpose, audienceHash, expiresAt.toISOString(), securityRevision],
    );
    return grantHash;
  }

  async function admitSample(
    pool: pg.Pool,
    db: InstanceType<typeof PgDatabase>,
    store: ReturnType<typeof createMinioStore>,
    seeded: { principalId: string; worldId: string; bindingId: string },
    fx: Fixture,
    retentionExpiresAt: Date | null,
  ) {
    const stager = new CaptureStager(db, store, testCrypto);
    const admission = new CaptureAdmission(db, testCrypto);
    const binding = Object.freeze({
      bindingId: uuid(seeded.bindingId),
      world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
      definitionId: 'csv-upload',
      state: 'active' as const,
      maxBytes: fx.maxBytes,
      allowedMediaTypes: Object.freeze(['text/csv']),
    });
    const bytes = new TextEncoder().encode('id,amount\n1,120.00\n');
    const staged = await stager.stageCapture(binding, bytes, {
      sourceNamespace: fx.sourceNamespace,
      externalId: 'bill-1',
      revision: 'r1',
      declaredMediaType: 'text/csv',
    });
    assert.ok(isStaged(staged));
    if (!isStaged(staged)) throw new Error('stage');
    const receipt = await admission.admitCapture({
      world: binding.world,
      bindingId: binding.bindingId,
      captureId: staged.captureId,
      mappingDigest: fx.mappingDigest,
      operationId: uuid(randomUUID()),
      principalId: uuid(seeded.principalId),
      rightsRef: 'rights:owner',
      retentionRef: 'retention:standard',
      domainId: fx.domain,
      predicateId: fx.predicate,
      subjectLabel: 'bill-1',
    });
    // Capture store version for durable read; set retention clock for disclosure tests.
    const version = await pool.query<{ version_id: string | null }>(
      `SELECT NULL::text AS version_id`,
    );
    void version;
    await pool.query(
      `UPDATE ontology.source_admissions
       SET retention_expires_at = $4::timestamptz,
           blob_version_id = COALESCE(blob_version_id, 'latest'),
           security_basis = 0,
           content_state = CASE WHEN $4::timestamptz IS NOT NULL AND $4::timestamptz <= clock_timestamp() THEN 'expired' ELSE 'available' END
       WHERE world_id=$1::uuid AND realm='live' AND evidence_id=$2::uuid AND mapping_digest=$3`,
      [seeded.worldId, receipt.evidenceId, fx.mappingDigest, retentionExpiresAt?.toISOString() ?? null],
    );
    return { binding, staged, receipt, bytes };
  }

  test('ZN-0027-AC', async () => {
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
      const reader = new EvidenceReader(db, store, testCrypto);
      try {
        const future = new Date(Date.now() + fx.retentionTtlSeconds * 1000);
        const past = new Date(Date.now() - 60_000);
        const admitted = await admitSample(pool, db, store, seeded, fx, future);

        const grantHash = await issueGrant(
          pool,
          seeded.worldId,
          seeded.principalId,
          fx.purpose,
          new Date(Date.now() + 3600_000),
          0,
        );

        // Authorized read succeeds and never discloses locators.
        const ok = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(ok.tag, 'Ok');
        if (ok.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(ok.value.contentDigest, admitted.staged.digest);
        assert.equal(Buffer.from(ok.value.bytes).equals(Buffer.from(admitted.bytes)), true);
        assertNoLocator(ok.value);

        // Retention expiry: authorized grant still present, but content unavailable.
        await pool.query(
          `UPDATE ontology.source_admissions
           SET retention_expires_at=$3::timestamptz, content_state='expired'
           WHERE world_id=$1::uuid AND evidence_id=$2::uuid`,
          [seeded.worldId, admitted.receipt.evidenceId, past.toISOString()],
        );
        const expired = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(expired.tag, 'HistoricalContentUnavailable');
        if (expired.tag !== 'HistoricalContentUnavailable') throw new Error('expected HCU');
        assert.equal(expired.value.explanation, 'RETENTION_EXPIRED');
        assert.equal(expired.value.evidenceId, admitted.receipt.evidenceId);
        assertNoLocator(expired.value);

        // Grant revocation via security_revision bump — no bytes/locator.
        await pool.query(
          `UPDATE ontology.worlds SET security_revision=2 WHERE world_id=$1::uuid AND realm='live'`,
          [seeded.worldId],
        );
        await pool.query(
          `UPDATE ontology.source_admissions
           SET retention_expires_at=$3::timestamptz, content_state='available'
           WHERE world_id=$1::uuid AND evidence_id=$2::uuid`,
          [seeded.worldId, admitted.receipt.evidenceId, future.toISOString()],
        );
        const revoked = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(revoked.tag, 'Denied');
        if (revoked.tag !== 'Denied') throw new Error('expected Denied');
        assert.equal(revoked.reason, 'GRANT_REVOKED');
        assertNoLocator(revoked);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0027-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const reader = new EvidenceReader(db, store, testCrypto);
      try {
        const future = new Date(Date.now() + fx.retentionTtlSeconds * 1000);
        const admitted = await admitSample(pool, db, store, seeded, fx, future);
        const grantHash = await issueGrant(
          pool,
          seeded.worldId,
          seeded.principalId,
          fx.purpose,
          new Date(Date.now() + 3600_000),
          0,
        );

        // Wrong-World ref
        const wrongWorld = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: Object.freeze({ worldId: uuid(randomUUID()), realm: 'live' as const }),
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(wrongWorld.tag, 'NotFoundOrDenied');
        assertNoLocator(wrongWorld);

        // Expired rights (grant past)
        const expiredGrant = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(expiredGrant.tag, 'Denied');
        if (expiredGrant.tag === 'Denied') assert.equal(expiredGrant.reason, 'GRANT_EXPIRED');
        assertNoLocator(expiredGrant);

        // No evidence disclosed for missing grant hash
        const missingGrant = await reader.readEvidence({
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(missingGrant.tag, 'NotFoundOrDenied');
        assertNoLocator(missingGrant);

        const receipts = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence_read_receipts
           WHERE world_id=$1::uuid AND outcome='authorized'`,
          [seeded.worldId],
        );
        assert.equal(receipts.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0027-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const reader = new EvidenceReader(db, store, testCrypto);
      try {
        const future = new Date(Date.now() + fx.retentionTtlSeconds * 1000);
        const admitted = await admitSample(pool, db, store, seeded, fx, future);
        const grantHash = await issueGrant(
          pool,
          seeded.worldId,
          seeded.principalId,
          fx.purpose,
          new Date(Date.now() + 3600_000),
          0,
        );
        const input = {
          evidence: {
            evidenceId: admitted.receipt.evidenceId,
            world: admitted.binding.world,
          },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        };

        // Same basis → deterministic authorized digest
        const a = await reader.readEvidence(input);
        const b = await reader.readEvidence(input);
        assert.equal(a.tag, 'Ok');
        assert.equal(b.tag, 'Ok');
        if (a.tag !== 'Ok' || b.tag !== 'Ok') throw new Error('expected Ok');
        assert.equal(a.value.contentDigest, b.value.contentDigest);
        assert.equal(Buffer.from(a.value.bytes).equals(Buffer.from(b.value.bytes)), true);
        assertNoLocator(a.value);

        // Changed basis (security bump) → explicit stale/denied, no bytes
        await pool.query(
          `UPDATE ontology.worlds SET security_revision = security_revision + 1
           WHERE world_id=$1::uuid AND realm='live'`,
          [seeded.worldId],
        );
        const stale = await reader.readEvidence(input);
        assert.equal(stale.tag, 'Denied');
        if (stale.tag === 'Denied') assert.equal(stale.reason, 'GRANT_REVOKED');
        assertNoLocator(stale);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });
}

await registerZn0027Tests();
