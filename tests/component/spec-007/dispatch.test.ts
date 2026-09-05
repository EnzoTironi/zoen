import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0043-dispatch-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-007/dispatch.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-007/dispatch.schema.json');
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

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0043-emit-${process.pid}`);
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

type Fixture = { seed: string; seedDigest: string; purpose: string; subjectLabel: string };

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

async function registerZn0043Tests(): Promise<void> {
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
  const testAuthorizer = { async authorize() { return true; } };
  const evidenceStore = {
    async putImmutable() {
      throw new Error('evidence store must not be used in ZN-0043 inspect path');
    },
    async readImmutable() {
      throw new Error('evidence store must not be used in ZN-0043 inspect path');
    },
  };

  function context(principalId: string, transport: 'web' | 'cli' = 'web') {
    return Object.freeze({
      principalId: uuid(principalId),
      sessionId: 'sess-zn0043',
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

  async function seedWorld(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
      worldName: 'Dispatch World',
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    const worldId = genesis.value.worldId as string;
    const subjectId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.subjects(world_id, realm, subject_id, type_id, label)
       VALUES ($1::uuid,'live',$2::uuid,'record',$3)`,
      [worldId, subjectId, fx.subjectLabel],
    );
    for (const domainId of ['sources', `claims:${subjectId}`]) {
      await pool.query(
        `INSERT INTO ontology.domains(world_id, realm, domain_id, version)
         VALUES ($1::uuid,'live',$2,0)
         ON CONFLICT DO NOTHING`,
        [worldId, domainId],
      );
    }
    return { principalId, worldId, subjectId, releaseDigest: fx.seedDigest };
  }

  function makeDispatcher(dbUrl: string, releaseDigest: string) {
    const db = new PgDatabase({ connectionString: dbUrl });
    const clock = { now: () => new Date().toISOString() };
    const authority = new Authority(db, testCrypto, clock, testAuthorizer, releaseDigest);
    const executor = new SemanticExecutor(authority, evidenceStore, releaseDigest);
    const dispatcher = new SemanticDispatcher(executor, releaseDigest);
    return { db, dispatcher, authority };
  }

  test('ZN-0043-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      // Prefer world release digest from DB
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [seeded.worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), releaseDigest);
      try {
        const ctx = context(seeded.principalId, 'web');
        const inspectBody = {
          schemaVersion: 1,
          operation: 'Inspect',
          operationId: randomUUID(),
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: { subjectId: seeded.subjectId },
        };
        const digest = contractDigestFor('Inspect', releaseDigest);
        const valid = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes(inspectBody),
            expectedContractDigest: digest,
          },
          ctx,
        );
        assert.equal(valid.tag, 'Ok');
        if (valid.tag !== 'Ok') throw new Error('inspect');
        assert.equal(JSON.stringify(valid).toLowerCase().includes('select '), false);

        const framesBefore = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.frames WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        assert.ok((framesBefore.rows[0]?.n ?? 0) >= 1);

        // SQL-looking raw path via CLI adapter — fail, no new frames
        const sqlAttempt = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes(inspectBody),
            rawSql: 'SELECT * FROM ontology.claims',
          },
          context(seeded.principalId, 'cli'),
        );
        assert.notEqual(sqlAttempt.tag, 'Ok');
        assert.equal(sqlAttempt.tag, 'Denied');
        if (sqlAttempt.tag !== 'Ok') assert.equal(sqlAttempt.code, 'RAW_SQL_FORBIDDEN');

        // Unknown operation
        const unknown = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({
              ...inspectBody,
              operation: 'DropAllTables',
              operationId: randomUUID(),
            }),
          },
          ctx,
        );
        assert.equal(unknown.tag, 'Unsupported');
        if (unknown.tag !== 'Ok') assert.equal(unknown.code, 'OPERATION_NOT_RELEASED');

        // Mismatched contract digest — no silent fallback
        const mismatched = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes({ ...inspectBody, operationId: randomUUID() }),
            expectedContractDigest: 'f'.repeat(64),
          },
          context(seeded.principalId, 'cli'),
        );
        assert.equal(mismatched.tag, 'ContractChanged');
        if (mismatched.tag !== 'Ok') assert.equal(mismatched.code, 'CONTRACT_DIGEST_MISMATCH');

        const framesAfter = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.frames WHERE world_id=$1::uuid`,
          [seeded.worldId],
        );
        // Only the valid inspect should have written a frame (failures never reached executor write)
        assert.equal(framesAfter.rows[0]?.n, framesBefore.rows[0]?.n);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0043-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [seeded.worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), releaseDigest);
      try {
        // Opaque evidence open without permission / missing — NotFoundOrDenied, no URL/leak
        const openEv = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({
              schemaVersion: 1,
              operation: 'OpenEvidence',
              operationId: randomUUID(),
              worldRef: { worldId: seeded.worldId, realm: 'live' },
              purpose: fx.purpose,
              expectedBasis: null,
              input: { evidenceId: randomUUID() },
            }),
          },
          context(seeded.principalId, 'web'),
        );
        assert.equal(openEv.tag, 'NotFoundOrDenied');
        const blob = JSON.stringify(openEv);
        assert.equal(blob.toLowerCase().includes('http'), false);
        assert.equal(blob.includes('object_key'), false);
        assert.equal(blob.includes('presign'), false);
        assert.equal(blob.includes('s3'), false);

        // Unregistered invoke method
        const invoke = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes({
              schemaVersion: 1,
              operation: 'Inspect',
              operationId: randomUUID(),
              worldRef: { worldId: seeded.worldId, realm: 'live' },
              purpose: fx.purpose,
              expectedBasis: null,
              input: { subjectId: seeded.subjectId },
            }),
            invokeMethod: 'executeSql',
          },
          context(seeded.principalId, 'cli'),
        );
        assert.equal(invoke.tag, 'Denied');
        if (invoke.tag !== 'Ok') assert.equal(invoke.code, 'UNREGISTERED_INVOKE');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0043-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [seeded.worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), releaseDigest);
      try {
        const ctx = context(seeded.principalId, 'web');
        const opId = randomUUID();
        const body = {
          schemaVersion: 1,
          operation: 'Discover',
          operationId: opId,
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: {},
        };
        const digest = contractDigestFor('Discover', releaseDigest);
        const raced = await Promise.all([
          dispatcher.invoke({ transport: 'web', envelopeBytes: envelopeBytes(body), expectedContractDigest: digest }, ctx),
          dispatcher.invoke({ transport: 'cli', envelopeBytes: envelopeBytes(body), expectedContractDigest: digest }, context(seeded.principalId, 'cli')),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');

        // Revoked access
        await pool.query(
          `UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [seeded.worldId, seeded.principalId],
        );
        const revoked = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }),
            expectedContractDigest: digest,
          },
          ctx,
        );
        assert.equal(revoked.tag, 'NotFoundOrDenied');

        // Unsupported oversized / malformed contract digest
        await pool.query(
          `UPDATE ontology.memberships SET state='active' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [seeded.worldId, seeded.principalId],
        );
        const badDigest = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }),
            expectedContractDigest: 'short',
          },
          ctx,
        );
        assert.equal(badDigest.tag, 'InvalidInput');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0043Tests();
