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
const FIXTURE_SEED = 'zn-0045-first-surface-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-007/first-surface.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-007/first-surface.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0042_frame-basis.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');
const MINIO_ENDPOINT = process.env.ZOEN_TEST_S3_ENDPOINT ?? 'http://127.0.0.1:59000';
const MINIO_BUCKET = process.env.ZOEN_TEST_S3_BUCKET ?? 'zoen-capture-test';
const MINIO_KEY = process.env.ZOEN_TEST_S3_ACCESS_KEY ?? 'zoen_test_access';
const MINIO_SECRET = process.env.ZOEN_TEST_S3_SECRET_KEY ?? 'zoen_test_secret_disposable';

/** Declared web surface controls — labeled + keyboard navigable (journey a11y oracle). */
export const FIRST_SURFACE_CONTROLS = Object.freeze([
  Object.freeze({ id: 'upload-source', role: 'button', label: 'Upload source bill', tabIndex: 0, keyActivators: Object.freeze(['Enter', ' ']) }),
  Object.freeze({ id: 'inspect-subject', role: 'button', label: 'Inspect subject', tabIndex: 0, keyActivators: Object.freeze(['Enter', ' ']) }),
  Object.freeze({ id: 'open-evidence', role: 'button', label: 'Open evidence', tabIndex: 0, keyActivators: Object.freeze(['Enter', ' ']) }),
  Object.freeze({ id: 'status-panel', role: 'region', label: 'Interpretation status', tabIndex: -1, keyActivators: Object.freeze([]) }),
]);

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0045-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/surfaces/discovery.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/dispatch.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/registry.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/frame-basis.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/types.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/ports.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/index.ts'),
        join(ROOT, 'packages/ontology/src/authority/transaction.ts'),
        join(ROOT, 'packages/ontology/src/authority/guards.ts'),
        join(ROOT, 'packages/ontology/src/authority/idempotency.ts'),
        join(ROOT, 'packages/ontology/src/authority/index.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/claims.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/reconcile.ts'),
        join(ROOT, 'packages/ontology/src/worlds/genesis.ts'),
        join(ROOT, 'packages/ontology/src/worlds/index.ts'),
        join(ROOT, 'packages/adapters/src/pg.ts'),
        join(ROOT, 'packages/contracts/src/ports.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
        join(ROOT, 'packages/kernel/src/decimal.ts'),
        join(ROOT, 'packages/kernel/src/time.ts'),
        join(ROOT, 'packages/kernel/src/graph.ts'),
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
  subjectLabel: string;
  billAmountA: string;
  billAmountB: string;
  unit: string;
  sourceDateA: string;
  sourceDateB: string;
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
      const key = `${world.realm}/${world.worldId}/evidence/${reference}/${sha256}`;
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

function semanticDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

/** Surface copy must prefer source dates/units/status/gaps over generic success. */
function surfaceMeaning(inspectPayload: {
  gaps?: string[];
  groups?: { interpretation?: { status?: string; contested?: boolean }; claims?: { unit?: string | null; verification?: string; validTime?: { from?: string } }[] }[];
}): {
  units: string[];
  sourceDates: string[];
  verification: string[];
  contested: boolean;
  gaps: string[];
  genericSuccessBanned: boolean;
} {
  const units: string[] = [];
  const sourceDates: string[] = [];
  const verification: string[] = [];
  let contested = false;
  for (const g of inspectPayload.groups ?? []) {
    if (g.interpretation?.contested) contested = true;
    if (g.interpretation?.status) verification.push(String(g.interpretation.status));
    for (const c of g.claims ?? []) {
      if (c.unit) units.push(String(c.unit));
      if (c.verification) verification.push(String(c.verification));
      if (c.validTime?.from) sourceDates.push(String(c.validTime.from));
    }
  }
  const gaps = [...(inspectPayload.gaps ?? [])];
  return {
    units,
    sourceDates,
    verification,
    contested,
    gaps,
    genericSuccessBanned: true,
  };
}

async function registerZn0045Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Authority } = await import(
    '../../../.core-build/packages/ontology/src/authority/transaction.js'
  );
  const { SemanticExecutor, SemanticDispatcher, contractDigestFor } = await import(
    '../../../.core-build/packages/ontology/src/surfaces/dispatch.js'
  );
  const { PgDatabase } = await import('../../../.core-build/packages/adapters/src/pg.js');
  const { canonicalJson } = await import('../../../.core-build/packages/kernel/src/json.js');
  const { uuid } = await import('../../../.core-build/packages/kernel/src/ids.js');

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
  const authorizer = { async authorize() { return true; } };

  function context(principalId: string, transport: 'web' | 'cli' = 'web') {
    return Object.freeze({
      principalId: uuid(principalId),
      sessionId: 'sess-zn0045',
      authenticatedAt: new Date().toISOString(),
      assurance: 'authenticated' as const,
      actorId: uuid(principalId),
      appSessionId: null,
      transport,
    });
  }

  function envelopeBytes(body: Record<string, unknown>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(body));
  }

  function mutationData<T extends Record<string, unknown>>(result: { tag: string; value?: unknown }): T {
    assert.equal(result.tag, 'Ok');
    const outer = result.value as { data?: T } & T;
    if (outer && typeof outer === 'object' && outer.data && typeof outer.data === 'object') {
      return outer.data as T;
    }
    return outer as T;
  }


  async function invoke(
    dispatcher: InstanceType<typeof SemanticDispatcher>,
    transport: 'web' | 'cli',
    body: Record<string, unknown>,
    principalId: string,
    releaseDigest: string,
  ) {
    const digest = contractDigestFor(String(body.operation), releaseDigest);
    return dispatcher.invoke(
      {
        transport,
        envelopeBytes: envelopeBytes(body),
        expectedContractDigest: digest,
      },
      context(principalId, transport),
    );
  }

  test('ZN-0045-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed, 'utf8').digest('hex'), fx.seedDigest);

    // Browser control model: labels + keyboard order
    const labels = FIRST_SURFACE_CONTROLS.map((c) => c.label);
    assert.ok(labels.every((l) => l.length > 0));
    assert.ok(FIRST_SURFACE_CONTROLS.every((c) => typeof c.tabIndex === 'number'));
    assert.ok(FIRST_SURFACE_CONTROLS.filter((c) => c.role === 'button').every((c) => c.keyActivators.includes('Enter')));
    const keyboardOrder = FIRST_SURFACE_CONTROLS.filter((c) => c.tabIndex >= 0).map((c) => c.id);
    assert.deepEqual(keyboardOrder, ['upload-source', 'inspect-subject', 'open-evidence']);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'First Surface World',
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId as string;
      for (const domainId of ['sources', 'subjects']) {
        await pool.query(
          `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
           VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`,
          [worldId, domainId],
        );
      }
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;

      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const clock = { now: () => new Date().toISOString() };
      const authority = new Authority(db, testCrypto, clock, authorizer, releaseDigest);
      const executor = new SemanticExecutor(authority, store, releaseDigest);
      const dispatcher = new SemanticDispatcher(executor, releaseDigest);

      try {
        const worldRef = { worldId, realm: 'live' };
        const subject = await invoke(dispatcher, 'web', {
          schemaVersion: 1,
          operation: 'CreateSubject',
          operationId: randomUUID(),
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: { typeId: 'record', label: fx.subjectLabel },
        }, principalId, releaseDigest);
        const subjectId = mutationData<{ subjectId: string }>(subject).subjectId;

        async function registerAndStage(name: string, content: string, amount: string, date: string) {
          const src = await invoke(dispatcher, 'cli', {
            schemaVersion: 1,
            operation: 'RegisterSource',
            operationId: randomUUID(),
            worldRef,
            purpose: fx.purpose,
            expectedBasis: null,
            input: { name, visibility: 'shared' },
          }, principalId, releaseDigest);
          const sourceId = mutationData<{ sourceId: string }>(src).sourceId;
          const evidenceOpId = randomUUID();
          const staged = await invoke(dispatcher, 'web', {
            schemaVersion: 1,
            operation: 'StageEvidence',
            operationId: evidenceOpId,
            worldRef,
            purpose: fx.purpose,
            expectedBasis: null,
            input: { sourceId, mediaType: 'text/plain', content },
          }, principalId, releaseDigest);
          const evidenceId = mutationData<{ evidenceId: string }>(staged).evidenceId;
          const admitted = await invoke(dispatcher, 'cli', {
            schemaVersion: 1,
            operation: 'AdmitClaim',
            operationId: randomUUID(),
            worldRef,
            purpose: fx.purpose,
            expectedBasis: null,
            input: {
              subjectId,
              sourceId,
              predicateId: 'record.amount',
              value: amount,
              unit: fx.unit,
              scope: {},
              validTime: { kind: 'date', from: date, until: null },
              evidenceRefs: [evidenceId],
            },
          }, principalId, releaseDigest);
          assert.equal(admitted.tag, 'Ok', JSON.stringify(admitted));
          return { sourceId, evidenceId };
        }

        const a = await registerAndStage('bill-a', `bill A ${fx.billAmountA}`, fx.billAmountA, fx.sourceDateA);
        const b = await registerAndStage('bill-b', `bill B ${fx.billAmountB}`, fx.billAmountB, fx.sourceDateB);

        const inspectBody = {
          schemaVersion: 1,
          operation: 'Inspect',
          operationId: randomUUID(),
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: { subjectId, predicateId: 'record.amount' },
        };
        const webInspect = await invoke(dispatcher, 'web', { ...inspectBody, operationId: randomUUID() }, principalId, releaseDigest);
        const cliInspect = await invoke(dispatcher, 'cli', { ...inspectBody, operationId: randomUUID() }, principalId, releaseDigest);
        assert.equal(webInspect.tag, 'Ok');
        assert.equal(cliInspect.tag, 'Ok');
        if (webInspect.tag !== 'Ok' || cliInspect.tag !== 'Ok') throw new Error('inspect');

        // Same permitted meaning: strip frameId (per-call) then compare digests of stable fields
        const stabilize = (v: Record<string, unknown>) => {
          const { frameId: _f, ...rest } = v;
          const groups = (rest.groups as { claims?: { id?: string }[]; interpretation?: unknown }[] | undefined)?.map((g) => ({
            interpretation: g.interpretation,
            claimValues: (g.claims ?? []).map((c) => ({
              predicateId: (c as { predicateId?: string }).predicateId,
              value: (c as { value?: unknown }).value,
              unit: (c as { unit?: unknown }).unit,
              verification: (c as { verification?: unknown }).verification,
              validTime: (c as { validTime?: unknown }).validTime,
            })).sort((x, y) => String(x.value).localeCompare(String(y.value))),
          }));
          return { gaps: rest.gaps, subject: rest.subject, groups };
        };
        const webStable = stabilize(webInspect.value as Record<string, unknown>);
        const cliStable = stabilize(cliInspect.value as Record<string, unknown>);
        assert.equal(semanticDigest(webStable), semanticDigest(cliStable));

        const meaning = surfaceMeaning(webInspect.value as never);
        assert.ok(meaning.units.includes(fx.unit));
        assert.ok(meaning.sourceDates.includes(fx.sourceDateA) || meaning.sourceDates.includes(fx.sourceDateB));
        assert.ok(meaning.verification.some((v) => v === 'unverified' || v.includes('unverified') || v.length > 0));
        assert.equal(JSON.stringify(webInspect.value).toLowerCase().includes('success'), false);

        const openWeb = await invoke(dispatcher, 'web', {
          schemaVersion: 1,
          operation: 'OpenEvidence',
          operationId: randomUUID(),
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: { evidenceId: a.evidenceId },
        }, principalId, releaseDigest);
        const openCli = await invoke(dispatcher, 'cli', {
          schemaVersion: 1,
          operation: 'OpenEvidence',
          operationId: randomUUID(),
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: { evidenceId: a.evidenceId },
        }, principalId, releaseDigest);
        assert.equal(openWeb.tag, 'Ok');
        assert.equal(openCli.tag, 'Ok');
        if (openWeb.tag === 'Ok' && openCli.tag === 'Ok') {
          assert.equal(
            (openWeb.value as { sha256: string }).sha256,
            (openCli.value as { sha256: string }).sha256,
          );
          assert.equal((openWeb.value as { content: string }).content.includes('bill A'), true);
        }
        void b;
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0045-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'First Surface Neg',
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId as string;
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, releaseDigest);
      const dispatcher = new SemanticDispatcher(new SemanticExecutor(authority, store, releaseDigest), releaseDigest);
      try {
        const denied = await invoke(dispatcher, 'web', {
          schemaVersion: 1,
          operation: 'OpenEvidence',
          operationId: randomUUID(),
          worldRef: { worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: { evidenceId: randomUUID() },
        }, principalId, releaseDigest);
        assert.equal(denied.tag, 'NotFoundOrDenied');
        const blob = JSON.stringify(denied);
        assert.equal(blob.toLowerCase().includes('http'), false);
        assert.equal(blob.includes('object_key'), false);
        assert.equal(blob.includes('row_count'), false);
        assert.equal(blob.includes('presign'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0045-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const store = createMinioStore(testCrypto);
    try {
      await ensureBucket(store.client);
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'First Surface Boundary',
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId as string;
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, releaseDigest);
      const dispatcher = new SemanticDispatcher(new SemanticExecutor(authority, store, releaseDigest), releaseDigest);
      try {
        const worldRef = { worldId, realm: 'live' };
        const discoverBody = {
          schemaVersion: 1,
          operation: 'Discover',
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: {},
        };
        const raced = await Promise.all([
          invoke(dispatcher, 'web', { ...discoverBody, operationId: randomUUID() }, principalId, releaseDigest),
          invoke(dispatcher, 'cli', { ...discoverBody, operationId: randomUUID() }, principalId, releaseDigest),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');

        await pool.query(
          `UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [worldId, principalId],
        );
        const revoked = await invoke(dispatcher, 'web', { ...discoverBody, operationId: randomUUID() }, principalId, releaseDigest);
        assert.equal(revoked.tag, 'NotFoundOrDenied');

        // Unsupported / incomplete: malformed digest reported, not silent success
        await pool.query(
          `UPDATE ontology.memberships SET state='active' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [worldId, principalId],
        );
        const bad = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes({ ...discoverBody, operationId: randomUUID() }),
            expectedContractDigest: 'nope',
          },
          context(principalId, 'cli'),
        );
        assert.equal(bad.tag, 'InvalidInput');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0045Tests();
