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
const FIXTURE_SEED = 'zn-0030-file-journey-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-004/file-journey.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-004/file-journey.schema.json');
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
  const cfgDir = join(tmpdir(), `zn-0030-emit-${process.pid}`);
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
  billAmount: string;
  billCurrency: string;
  mappingDigest: string;
  extractorVersion: string;
  mappingVersion: string;
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
    async readImmutable(artifact: { key: string; sha256: string; size: string; versionId: string }) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: artifact.key,
          ...(artifact.versionId !== 'latest' ? { VersionId: artifact.versionId } : {}),
        }),
      );
      if (!response.Body) {
        throw Object.assign(new Error('ARTIFACT_UNAVAILABLE'), { tag: 'HistoricalContentUnavailable' });
      }
      const bytes = await response.Body.transformToByteArray();
      const sha256 = await crypto.sha256(bytes);
      if (sha256 !== artifact.sha256 || String(bytes.byteLength) !== artifact.size) {
        throw Object.assign(new Error('ARTIFACT_INTEGRITY'), { tag: 'Unavailable' });
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

async function registerZn0030Tests(): Promise<void> {
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
  const { EvidenceExtractor } = await import(
    '../../../.core-build/packages/ontology/src/evidence/extract.js'
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

  async function seedOwnerWorld(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    const worldId = genesis.value.worldId as string;
    const bindingId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.domains(world_id,realm,domain_id,version)
       VALUES ($1::uuid,'live','bills',0), ($1::uuid,'live','messages',0)
       ON CONFLICT DO NOTHING`,
      [worldId],
    );
    await pool.query(
      `INSERT INTO ontology.source_bindings(world_id,realm,binding_id,definition_id,state,max_bytes,allowed_media_types)
       VALUES ($1::uuid,'live',$2::uuid,'file-upload','active',$3,ARRAY['text/csv','application/json','text/plain'])`,
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
  ) {
    const grantHash = createHash('sha256')
      .update(`${worldId}|${principalId}|${purpose}|${expiresAt.toISOString()}`)
      .digest('hex');
    const audienceHash = createHash('sha256').update(principalId).digest('hex');
    await pool.query(
      `INSERT INTO ontology.grants(
         grant_hash, world_id, realm, principal_id, purpose, audience_hash,
         assurance, expires_at, security_revision
       ) VALUES ($1,$2::uuid,'live',$3::uuid,$4,$5,'presence',$6,0)
       ON CONFLICT DO NOTHING`,
      [grantHash, worldId, principalId, purpose, audienceHash, expiresAt.toISOString()],
    );
    return grantHash;
  }

  /**
   * Journey assembly: build a Frame from two admitted sources without inventing Settlement.
   * A user "paid" claim without bank settlement evidence stays unverified.
   */
  async function askPaymentVerified(
    pool: pg.Pool,
    crypto: typeof testCrypto,
    args: {
      worldId: string;
      principalId: string;
      purpose: string;
      billSourceId: string;
      messageSourceId: string;
      billAmount: string;
      billCurrency: string;
      userClaimedPaid: boolean;
      hasBankSettlementEvidence: boolean;
    },
  ) {
    const frameId = crypto.randomId();
    const paymentVerification =
      args.userClaimedPaid && args.hasBankSettlementEvidence ? 'verified' : 'unverified';
    const settlementEmitted = false; // INV-02: user "paid" never creates provider Settlement
    const payload = {
      question: 'is_payment_verified',
      bill: { amount: args.billAmount, currency: args.billCurrency },
      userAssertion: args.userClaimedPaid ? 'paid' : 'unknown',
      paymentVerification,
      settlementEmitted,
      kind: 'FilePaymentInquiry',
    };
    const headDigest = await crypto.digest({ worldId: args.worldId, sources: [args.billSourceId, args.messageSourceId] });
    const basis = {
      sources: [args.billSourceId, args.messageSourceId],
      paymentVerification,
      settlementEmitted,
    };
    await pool.query(
      `INSERT INTO ontology.frames(
         world_id, realm, frame_id, principal_id, purpose, head_digest, basis, payload, source_ids, expires_at
       ) VALUES (
         $1::uuid,'live',$2::uuid,$3::uuid,$4,$5,$6::jsonb,$7::jsonb,$8::uuid[], clock_timestamp() + interval '1 hour'
       )`,
      [
        args.worldId,
        frameId,
        args.principalId,
        args.purpose,
        headDigest,
        canonicalJson(basis),
        canonicalJson(payload),
        [args.billSourceId, args.messageSourceId],
      ],
    );
    return { frameId, payload, basis };
  }

  test('ZN-0030-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(fx.billAmount, '120.00');
    assert.equal(fx.billCurrency, 'BRL');

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedOwnerWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      const extractor = new EvidenceExtractor(db, testCrypto);
      const reader = new EvidenceReader(db, store, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'file-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv', 'application/json', 'text/plain']),
        });

        // Source 1: grandmother bill 120.00 BRL via normal file API
        const billCsv = new TextEncoder().encode(
          `invoice,amount,currency\nGM-BILL-1,${fx.billAmount},${fx.billCurrency}\n`,
        );
        const billStage = await stager.stageCapture(binding, billCsv, {
          sourceNamespace: 'uploads.bills',
          externalId: 'GM-BILL-1',
          revision: 'r1',
          declaredMediaType: 'text/csv',
          declaredFileName: 'grandmother-bill.csv',
        });
        assert.ok(isStaged(billStage));
        if (!isStaged(billStage)) throw new Error('bill stage');
        const billAdmit = await admission.admitCapture({
          world: binding.world,
          bindingId: binding.bindingId,
          captureId: billStage.captureId,
          mappingDigest: fx.mappingDigest,
          operationId: uuid(randomUUID()),
          principalId: uuid(seeded.principalId),
          rightsRef: 'rights:owner',
          retentionRef: 'retention:standard',
          domainId: 'bills',
          predicateId: 'bill_row',
          subjectLabel: 'GM-BILL-1',
        });
        const billExtract = await extractor.extract({
          world: binding.world,
          bytes: billCsv,
          profile: Object.freeze({
            kind: 'csv' as const,
            delimiter: ',' as const,
            hasHeader: true,
            locale: 'en-US' as const,
          }),
          mappingVersion: fx.mappingVersion,
          evidenceId: billAdmit.evidenceId,
          captureId: billStage.captureId,
        });
        assert.equal(billExtract.tag, 'Ok');

        // Source 2: user message claiming paid — no bank settlement evidence
        const msgJson = new TextEncoder().encode(
          JSON.stringify({
            from: 'user',
            text: 'ja paguei a conta da vo',
            claimedPaid: true,
            bankSettlementRef: null,
          }),
        );
        const msgStage = await stager.stageCapture(binding, msgJson, {
          sourceNamespace: 'uploads.messages',
          externalId: 'MSG-PAID-CLAIM-1',
          revision: 'r1',
          declaredMediaType: 'application/json',
          declaredFileName: 'user-paid-claim.json',
        });
        assert.ok(isStaged(msgStage));
        if (!isStaged(msgStage)) throw new Error('msg stage');
        const msgAdmit = await admission.admitCapture({
          world: binding.world,
          bindingId: binding.bindingId,
          captureId: msgStage.captureId,
          mappingDigest: fx.mappingDigest,
          operationId: uuid(randomUUID()),
          principalId: uuid(seeded.principalId),
          rightsRef: 'rights:owner',
          retentionRef: 'retention:standard',
          domainId: 'messages',
          predicateId: 'user_message',
          subjectLabel: 'MSG-PAID-CLAIM-1',
        });

        // Current-rights read of both artifacts
        const grantHash = await issueGrant(
          pool,
          seeded.worldId,
          seeded.principalId,
          fx.purpose,
          new Date(Date.now() + 3600_000),
        );
        await pool.query(
          `UPDATE ontology.source_admissions
           SET blob_version_id='latest', content_state='available', security_basis=0
           WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        const billRead = await reader.readEvidence({
          evidence: { evidenceId: billAdmit.evidenceId, world: binding.world },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        const msgRead = await reader.readEvidence({
          evidence: { evidenceId: msgAdmit.evidenceId, world: binding.world },
          grant: {
            grantHash,
            principalId: uuid(seeded.principalId),
            purpose: fx.purpose,
            securityRevision: 0,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          nowIso: new Date().toISOString(),
        });
        assert.equal(billRead.tag, 'Ok');
        assert.equal(msgRead.tag, 'Ok');

        // ACT: user asks whether payment is verified
        const frame = await askPaymentVerified(pool, testCrypto, {
          worldId: seeded.worldId,
          principalId: seeded.principalId,
          purpose: fx.purpose,
          billSourceId: billAdmit.sourceId,
          messageSourceId: msgAdmit.sourceId,
          billAmount: fx.billAmount,
          billCurrency: fx.billCurrency,
          userClaimedPaid: true,
          hasBankSettlementEvidence: false,
        });

        assert.equal(frame.payload.paymentVerification, 'unverified');
        assert.equal(frame.payload.settlementEmitted, false);

        const stored = await pool.query<{ source_ids: string[]; payload: { paymentVerification: string; settlementEmitted: boolean } }>(
          `SELECT source_ids::text[] AS source_ids, payload
           FROM ontology.frames WHERE world_id=$1::uuid AND frame_id=$2::uuid`,
          [seeded.worldId, frame.frameId],
        );
        assert.equal(stored.rows.length, 1);
        const sources = stored.rows[0]!.source_ids;
        assert.equal(sources.length, 2);
        assert.ok(sources.includes(billAdmit.sourceId));
        assert.ok(sources.includes(msgAdmit.sourceId));
        assert.equal(stored.rows[0]!.payload.paymentVerification, 'unverified');
        assert.equal(stored.rows[0]!.payload.settlementEmitted, false);

        // Never emit provider Settlement (no settlements table rows / no settlement outbox)
        const settlementTables = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema='ontology' AND table_name IN ('settlements','effect_settlements','provider_settlements')
           ) AS exists`,
        );
        if (settlementTables.rows[0]?.exists) {
          const n = await pool.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM ontology.settlements WHERE world_id=$1::uuid`,
            [seeded.worldId],
          ).catch(async () => {
            return pool.query<{ n: number }>(
              `SELECT 0::int AS n`,
            );
          });
          assert.equal(n.rows[0]?.n ?? 0, 0);
        }
        const outbox = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM jobs.outbox
           WHERE world_id=$1::uuid AND owner ILIKE '%settlement%'`,
          [seeded.worldId],
        ).catch(async () => ({ rows: [{ n: 0 }] }));
        assert.equal(outbox.rows[0]?.n ?? 0, 0);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0030-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedOwnerWorld(pool, fx);
      const other = await seedOwnerWorld(pool, {
        ...fx,
        seedDigest: '6666666666666666666666666666666666666666666666666666666666666666',
      });
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'file-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv', 'application/json', 'text/plain']),
        });
        const staged = await stager.stageCapture(
          binding,
          new TextEncoder().encode('a,b\n1,2\n'),
          {
            sourceNamespace: 'uploads.bills',
            externalId: 'neg',
            revision: 'r1',
            declaredMediaType: 'text/csv',
          },
        );
        assert.ok(isStaged(staged));
        if (!isStaged(staged)) throw new Error('stage');

        // Denied second World — wrong-World admit
        let denied = false;
        try {
          await admission.admitCapture({
            world: Object.freeze({ worldId: uuid(other.worldId), realm: 'live' as const }),
            bindingId: binding.bindingId,
            captureId: staged.captureId,
            mappingDigest: fx.mappingDigest,
            operationId: uuid(randomUUID()),
            principalId: uuid(other.principalId),
            rightsRef: 'rights:owner',
            retentionRef: 'retention:standard',
            domainId: 'bills',
            predicateId: 'bill_row',
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

        const evidenceOther = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [other.worldId],
        );
        assert.equal(evidenceOther.rows[0]?.n, 0);
        const evidenceSeeded = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.evidence WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.equal(evidenceSeeded.rows[0]?.n, 0);
      } finally {
        await db.close();
      }
    } finally {
      store.client.destroy();
      await pool.end();
    }
  });

  test('ZN-0030-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const seeded = await seedOwnerWorld(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const stager = new CaptureStager(db, store, testCrypto);
      const admission = new CaptureAdmission(db, testCrypto);
      const gc = new CaptureGarbageCollector(db, store, testCrypto);
      try {
        const binding = Object.freeze({
          bindingId: uuid(seeded.bindingId),
          world: Object.freeze({ worldId: uuid(seeded.worldId), realm: 'live' as const }),
          definitionId: 'file-upload',
          state: 'active' as const,
          maxBytes: fx.maxBytes,
          allowedMediaTypes: Object.freeze(['text/csv', 'application/json', 'text/plain']),
        });
        const bytes = new TextEncoder().encode(
          `invoice,amount,currency\nGM-BILL-1,${fx.billAmount},${fx.billCurrency}\n`,
        );

        // Duplicate upload — identical captures admit once
        const c1 = await stager.stageCapture(binding, bytes, {
          sourceNamespace: 'uploads.bills',
          externalId: 'GM-BILL-1',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        const c2 = await stager.stageCapture(binding, bytes, {
          sourceNamespace: 'uploads.bills',
          externalId: 'GM-BILL-1',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(c1) && isStaged(c2));
        if (!isStaged(c1) || !isStaged(c2)) throw new Error('stage');
        assert.equal(c1.digest, c2.digest);

        const raced = await Promise.all([
          admission.admitCapture({
            world: binding.world,
            bindingId: binding.bindingId,
            captureId: c1.captureId,
            mappingDigest: fx.mappingDigest,
            operationId: uuid(randomUUID()),
            principalId: uuid(seeded.principalId),
            rightsRef: 'rights:owner',
            retentionRef: 'retention:standard',
            domainId: 'bills',
            predicateId: 'bill_row',
            subjectLabel: 'GM-BILL-1',
          }),
          admission.admitCapture({
            world: binding.world,
            bindingId: binding.bindingId,
            captureId: c2.captureId,
            mappingDigest: fx.mappingDigest,
            operationId: uuid(randomUUID()),
            principalId: uuid(seeded.principalId),
            rightsRef: 'rights:owner',
            retentionRef: 'retention:standard',
            domainId: 'bills',
            predicateId: 'bill_row',
            subjectLabel: 'GM-BILL-1',
          }),
        ]);
        assert.equal(raced[0]!.evidenceId, raced[1]!.evidenceId);
        assert.equal(raced.filter((r) => r.firstAdmission).length, 1);

        // Source outage simulation: GC must not delete admitted bytes; orphan without pin deletable
        const orphan = await stager.stageCapture(binding, new TextEncoder().encode('tmp,x\n1,1\n'), {
          sourceNamespace: 'uploads.tmp',
          externalId: 'orphan-outage',
          revision: 'r1',
          declaredMediaType: 'text/csv',
        });
        assert.ok(isStaged(orphan));
        if (!isStaged(orphan)) throw new Error('orphan');
        const past = new Date(Date.now() - 10_000).toISOString();
        await pool.query(
          `UPDATE ontology.captures
           SET upload_lease_expires_at=$3::timestamptz, pending_admission=false
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, orphan.captureId, past],
        );
        const del = await gc.collectOrphan({
          world: binding.world,
          captureId: orphan.captureId,
          nowIso: new Date().toISOString(),
        });
        assert.equal(del.tag, 'Deleted');

        const admittedAlive = await pool.query<{ gc_deleted_at: string | null }>(
          `SELECT gc_deleted_at::text FROM ontology.captures
           WHERE world_id=$1::uuid AND capture_id=$2::uuid`,
          [seeded.worldId, c1.captureId],
        );
        assert.equal(admittedAlive.rows[0]?.gc_deleted_at, null);

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

await registerZn0030Tests();
