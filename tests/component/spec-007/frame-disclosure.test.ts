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
const FIXTURE_SEED = 'zn-0046-frame-disclosure-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-007/frame-disclosure.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-007/frame-disclosure.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0019_schema.sql',
  'db/migrations/zn-0021_idempotency.sql',
  'db/migrations/zn-0023_outbox.sql',
  'db/migrations/zn-0042_frame-basis.sql',
  'db/migrations/zn-0046_frame-disclosure.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0046-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/surfaces/frame-disclosure.ts'),
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
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', env: process.env });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();

type Fixture = { seed: string; seedDigest: string; purpose: string; subjectLabel: string };
function fixture(): Fixture { return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture; }
function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}
async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ontology CASCADE; DROP SCHEMA IF EXISTS jobs CASCADE; DROP SCHEMA IF EXISTS door CASCADE; DROP SCHEMA IF EXISTS eve CASCADE; DROP SCHEMA IF EXISTS channels CASCADE;`);
  for (const role of ['zoen_authority','zoen_door','zoen_eve','zoen_channel','zoen_outbox','zoen_progress']) await pool.query(`DROP ROLE IF EXISTS ${role}`);
  for (const sql of SQLS) if (existsSync(sql)) await pool.query(readFileSync(sql, 'utf8'));
}

async function registerZn0046Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');
  const { Authority } = await import('../../../.core-build/packages/ontology/src/authority/transaction.js');
  const { SemanticExecutor, SemanticDispatcher, contractDigestFor } = await import('../../../.core-build/packages/ontology/src/surfaces/dispatch.js');
  const { FrameDisclosureService } = await import('../../../.core-build/packages/ontology/src/surfaces/frame-disclosure.js');
  const { PgDatabase } = await import('../../../.core-build/packages/adapters/src/pg.js');
  const { canonicalJson } = await import('../../../.core-build/packages/kernel/src/json.js');
  const { uuid } = await import('../../../.core-build/packages/kernel/src/ids.js');

  const testCrypto = {
    randomId: () => uuid(randomUUID()),
    randomReference: () => randomUUID().replace(/-/g, ''),
    async sha256(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex'); },
    async digest(value: unknown) { return createHash('sha256').update(canonicalJson(value as never), 'utf8').digest('hex'); },
  };
  const authorizer = { async authorize() { return true; } };
  const evidenceStore = {
    async putImmutable() { throw new Error('unused'); },
    async readImmutable() { throw new Error('unused'); },
  };

  function context(principalId: string) {
    return Object.freeze({
      principalId: uuid(principalId), sessionId: 'sess-zn0046', authenticatedAt: new Date().toISOString(),
      assurance: 'authenticated' as const, actorId: uuid(principalId), appSessionId: null, transport: 'web' as const,
    });
  }
  function envelopeBytes(body: Record<string, unknown>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(body));
  }

  async function seed(pool: pg.Pool, fx: Fixture) {
    const principalId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId, operationId: randomUUID(), seedDigest: fx.seedDigest, worldName: 'Disclosure World',
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    const worldId = genesis.value.worldId as string;
    for (const domainId of ['sources', 'subjects']) {
      await pool.query(`INSERT INTO ontology.domains(world_id,realm,domain_id,version) VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`, [worldId, domainId]);
    }
    const subjectId = randomUUID();
    await pool.query(`INSERT INTO ontology.subjects(world_id,realm,subject_id,type_id,label) VALUES ($1::uuid,'live',$2::uuid,'record',$3)`, [worldId, subjectId, fx.subjectLabel]);
    await pool.query(`INSERT INTO ontology.domains(world_id,realm,domain_id,version) VALUES ($1::uuid,'live',$2,0) ON CONFLICT DO NOTHING`, [worldId, `claims:${subjectId}`]);
    const sourceId = randomUUID();
    await pool.query(`INSERT INTO ontology.sources(world_id,realm,source_id,family_id,name,visibility,created_by) VALUES ($1::uuid,'live',$2::uuid,$3::uuid,'src','shared',$4::uuid)`, [worldId, sourceId, randomUUID(), principalId]);
    const evidenceId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.evidence(world_id,realm,evidence_id,source_id,object_key,content_digest,size_bytes,media_type,object_version,content_state)
       VALUES ($1::uuid,'live',$2::uuid,$3::uuid,'obj/k',$4,1,'text/plain','v1','available')`,
      [worldId, evidenceId, sourceId, 'c'.repeat(64)],
    );
    const rel = await pool.query<{ release_digest: string; security_revision: string }>(
      `SELECT release_digest, security_revision::text FROM ontology.worlds WHERE world_id=$1::uuid`, [worldId],
    );
    return {
      principalId, worldId, subjectId, sourceId, evidenceId,
      releaseDigest: rel.rows[0]!.release_digest,
      securityRevision: rel.rows[0]!.security_revision,
    };
  }

  test('ZN-0046-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(createHash('sha256').update(fx.seed,'utf8').digest('hex'), fx.seedDigest);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, seeded.releaseDigest);
      const dispatcher = new SemanticDispatcher(new SemanticExecutor(authority, evidenceStore, seeded.releaseDigest), seeded.releaseDigest);
      try {
        // Create a retained frame via Inspect
        const inspect = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'Inspect', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { subjectId: seeded.subjectId },
          }),
          expectedContractDigest: contractDigestFor('Inspect', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(inspect.tag, 'Ok');
        if (inspect.tag !== 'Ok') throw new Error('inspect');
        const frameId = (inspect.value as { frameId: string }).frameId;

        // Authorized unchanged reopen => SameHistoricalFrame, basis not refreshed
        const opened = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'OpenFrame', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { frameId },
          }),
          expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(opened.tag, 'Ok');
        if (opened.tag !== 'Ok') throw new Error('open');
        const same = opened.value as { tag: string; basisRefreshed?: boolean; rightsRechecked?: boolean };
        assert.equal(same.tag, 'SameHistoricalFrame');
        assert.equal(same.basisRefreshed, false);
        assert.equal(same.rightsRechecked, true);

        // Revoked membership => no payload
        await pool.query(`UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1::uuid AND principal_id=$2::uuid`, [seeded.worldId, seeded.principalId]);
        const revoked = await dispatcher.invoke({
          transport: 'cli',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'OpenFrame', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { frameId },
          }),
          expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(revoked.tag, 'NotFoundOrDenied');
        assert.equal(JSON.stringify(revoked).includes('payload'), false);

        // Erased evidence => HistoricalContentUnavailable
        await pool.query(`UPDATE ontology.memberships SET state='active' WHERE world_id=$1::uuid AND principal_id=$2::uuid`, [seeded.worldId, seeded.principalId]);
        await pool.query(`UPDATE ontology.evidence SET content_state='erased', erased_at=clock_timestamp() WHERE world_id=$1::uuid AND evidence_id=$2::uuid`, [seeded.worldId, seeded.evidenceId]);
        const erased = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'OpenEvidence', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { evidenceId: seeded.evidenceId },
          }),
          expectedContractDigest: contractDigestFor('OpenEvidence', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(erased.tag, 'HistoricalContentUnavailable');
        if (erased.tag !== 'Ok') assert.equal(erased.code, 'EVIDENCE_ERASED');
      } finally { await db.close(); }
    } finally { await pool.end(); }
  });

  test('ZN-0046-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, seeded.releaseDigest);
      const dispatcher = new SemanticDispatcher(new SemanticExecutor(authority, evidenceStore, seeded.releaseDigest), seeded.releaseDigest);
      try {
        const denied = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'OpenFrame', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { frameId: randomUUID() },
          }),
          expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest),
        }, context(seeded.principalId));
        // missing frame => HistoricalContentUnavailable (explicit union) or NotFoundOrDenied via deny path
        assert.ok(denied.tag === 'HistoricalContentUnavailable' || denied.tag === 'NotFoundOrDenied');
        const blob = JSON.stringify(denied);
        assert.equal(blob.toLowerCase().includes('http'), false);
        assert.equal(blob.includes('row_count'), false);
        assert.equal(blob.includes('object_key'), false);
      } finally { await db.close(); }
    } finally { await pool.end(); }
  });

  test('ZN-0046-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seed(pool, fx);
      const db = new PgDatabase({ connectionString: requireDbUrl() });
      const authority = new Authority(db, testCrypto, { now: () => new Date().toISOString() }, authorizer, seeded.releaseDigest);
      const dispatcher = new SemanticDispatcher(new SemanticExecutor(authority, evidenceStore, seeded.releaseDigest), seeded.releaseDigest);
      try {
        const inspect = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({
            schemaVersion: 1, operation: 'Inspect', operationId: randomUUID(),
            worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
            input: { subjectId: seeded.subjectId },
          }),
          expectedContractDigest: contractDigestFor('Inspect', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(inspect.tag, 'Ok');
        if (inspect.tag !== 'Ok') throw new Error('inspect');
        const frameId = (inspect.value as { frameId: string }).frameId;

        // Duplicate concurrent reopens
        const body = {
          schemaVersion: 1, operation: 'OpenFrame',
          worldRef: { worldId: seeded.worldId, realm: 'live' }, purpose: fx.purpose, expectedBasis: null,
          input: { frameId },
        };
        const raced = await Promise.all([
          dispatcher.invoke({ transport: 'web', envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }), expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest) }, context(seeded.principalId)),
          dispatcher.invoke({ transport: 'cli', envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }), expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest) }, context(seeded.principalId)),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');

        // Head digest changed => NewerFrame (no silent refresh)
        await pool.query(`UPDATE ontology.frames SET head_digest=$1 WHERE world_id=$2::uuid AND frame_id=$3::uuid`, ['f'.repeat(64), seeded.worldId, frameId]);
        const newer = await dispatcher.invoke({
          transport: 'web',
          envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }),
          expectedContractDigest: contractDigestFor('OpenFrame', seeded.releaseDigest),
        }, context(seeded.principalId));
        assert.equal(newer.tag, 'Ok');
        if (newer.tag === 'Ok') {
          assert.equal((newer.value as { tag: string }).tag, 'NewerFrame');
          assert.equal((newer.value as { basisRefreshed?: boolean }).basisRefreshed, undefined);
        }

        // Pure service: expired frame
        const svc = new FrameDisclosureService();
        const expired = svc.reopen({
          world: { worldId: uuid(seeded.worldId), realm: 'live' },
          frameId: uuid(frameId),
          principalId: uuid(seeded.principalId),
          purpose: fx.purpose,
          currentSecurityRevision: seeded.securityRevision,
          currentHeadDigest: 'a'.repeat(64),
          sourcesStillAllowed: true,
          membershipActive: true,
        }, { payload: '{}', head_digest: 'a'.repeat(64), source_ids: [], expired: true });
        assert.equal(expired.tag, 'HistoricalContentUnavailable');
        if (expired.tag === 'HistoricalContentUnavailable') assert.equal(expired.reason, 'FRAME_EXPIRED');
      } finally { await db.close(); }
    } finally { await pool.end(); }
  });
}

await registerZn0046Tests();
