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

async function registerZn0046Tests(): Promise<void> {
  const { createPersonalWorld } = await import(
    '../../../.core-build/packages/ontology/src/worlds/genesis.js'
  );
  const { Authority } = await import(
    '../../../.core-build/packages/ontology/src/authority/transaction.js'
  );
  const { SemanticExecutor, SemanticDispatcher, contractDigestFor } = await import(
    '../../../.core-build/packages/ontology/src/surfaces/dispatch.js'
  );
  const {
    FrameDisclosureService,
    frameDisclosureDigest,
  } = await import('../../../.core-build/packages/ontology/src/surfaces/frame-disclosure.js');
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
      throw new Error('evidence store unused in frame-disclosure path');
    },
    async readImmutable() {
      throw new Error('evidence store unused in frame-disclosure path');
    },
  };

  function context(principalId: string, transport: 'web' | 'cli' = 'web') {
    return Object.freeze({
      principalId: uuid(principalId),
      sessionId: 'sess-zn0046',
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
      worldName: 'Disclosure World',
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
    const sourceId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.sources(world_id, realm, source_id, family_id, name, visibility, created_by)
       VALUES ($1::uuid,'live',$2::uuid,$3::uuid,'disclosure-source','shared',$4::uuid)`,
      [worldId, sourceId, randomUUID(), principalId],
    );
    const rel = await pool.query<{ release_digest: string; security_revision: string }>(
      `SELECT release_digest, security_revision::text FROM ontology.worlds WHERE world_id=$1::uuid`,
      [worldId],
    );
    return {
      principalId,
      worldId,
      subjectId,
      sourceId,
      releaseDigest: rel.rows[0]!.release_digest,
      securityRevision: rel.rows[0]!.security_revision,
    };
  }

  function makeDispatcher(dbUrl: string, releaseDigest: string) {
    const db = new PgDatabase({ connectionString: dbUrl });
    const clock = { now: () => new Date().toISOString() };
    const authority = new Authority(db, testCrypto, clock, testAuthorizer, releaseDigest);
    const executor = new SemanticExecutor(authority, evidenceStore, releaseDigest);
    const dispatcher = new SemanticDispatcher(executor, releaseDigest);
    return { db, dispatcher, authority };
  }

  async function inspectFrame(
    dispatcher: InstanceType<typeof SemanticDispatcher>,
    seeded: { principalId: string; worldId: string; subjectId: string; releaseDigest: string },
    purpose: string,
  ) {
    const digest = contractDigestFor('Inspect', seeded.releaseDigest);
    const result = await dispatcher.invoke(
      {
        transport: 'web',
        envelopeBytes: envelopeBytes({
          schemaVersion: 1,
          operation: 'Inspect',
          operationId: randomUUID(),
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose,
          expectedBasis: null,
          input: { subjectId: seeded.subjectId },
        }),
        expectedContractDigest: digest,
      },
      context(seeded.principalId, 'web'),
    );
    assert.equal(result.tag, 'Ok');
    if (result.tag !== 'Ok') throw new Error('inspect');
    const frameId = (result.value as { frameId: string }).frameId;
    assert.ok(frameId);
    return frameId;
  }

  async function openFrame(
    dispatcher: InstanceType<typeof SemanticDispatcher>,
    seeded: { principalId: string; worldId: string; releaseDigest: string },
    purpose: string,
    frameId: string,
    principalId?: string,
  ) {
    const digest = contractDigestFor('OpenFrame', seeded.releaseDigest);
    return dispatcher.invoke(
      {
        transport: 'web',
        envelopeBytes: envelopeBytes({
          schemaVersion: 1,
          operation: 'OpenFrame',
          operationId: randomUUID(),
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose,
          expectedBasis: null,
          input: { frameId },
        }),
        expectedContractDigest: digest,
      },
      context(principalId ?? seeded.principalId, 'web'),
    );
  }

  test('ZN-0046-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(
      createHash('sha256').update(fx.seed, 'utf8').digest('hex'),
      fx.seedDigest,
    );

    // Pure oracle: revoked / erased / unchanged reopen (synthetic records, real service).
    const disclosure = new FrameDisclosureService();
    const world = { worldId: uuid(randomUUID()), realm: 'live' as const };
    const frameId = uuid(randomUUID());
    const principalId = uuid(randomUUID());
    const head = 'a'.repeat(64);
    const payload = { pinned: true, note: 'historical' };
    const row = Object.freeze({
      payload: canonicalJson(payload),
      head_digest: head,
      source_ids: [randomUUID()],
      expired: false,
    });

    const same = disclosure.reopen({
      world,
      frameId,
      principalId,
      purpose: fx.purpose,
      currentSecurityRevision: '1',
      currentHeadDigest: head,
      sourcesStillAllowed: true,
      membershipActive: true,
    }, row);
    assert.equal(same.tag, 'SameHistoricalFrame');
    if (same.tag === 'SameHistoricalFrame') {
      assert.equal(same.basisRefreshed, false);
      assert.equal(same.rightsRechecked, true);
      assert.equal(canonicalJson(same.payload as never), canonicalJson(payload as never));
      assert.equal(same.headDigest, head);
    }

    const revoked = disclosure.reopen({
      world,
      frameId,
      principalId,
      purpose: fx.purpose,
      currentSecurityRevision: '1',
      currentHeadDigest: head,
      sourcesStillAllowed: true,
      membershipActive: false,
    }, row);
    assert.equal(revoked.tag, 'Denied');
    if (revoked.tag === 'Denied') assert.equal(revoked.reason, 'REVOKED');
    assert.equal('payload' in revoked, false);

    const erased = disclosure.discloseEvidence({
      world,
      evidenceId: uuid(randomUUID()),
      contentState: 'erased',
      sourceAllowed: true,
      membershipActive: true,
    });
    assert.equal(erased.tag, 'HistoricalContentUnavailable');
    if (erased.tag === 'HistoricalContentUnavailable') {
      assert.equal(erased.reason, 'EVIDENCE_ERASED');
    }
    assert.equal('payload' in erased, false);
    assert.equal('content' in erased, false);

    // Real PG: Inspect then OpenFrame under active membership; revoke => no payload.
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const createdFrameId = await inspectFrame(dispatcher, seeded, fx.purpose);
        const opened = await openFrame(dispatcher, seeded, fx.purpose, createdFrameId);
        assert.equal(opened.tag, 'Ok');
        if (opened.tag !== 'Ok') throw new Error('open');
        const outcome = opened.value as {
          tag: string;
          basisRefreshed?: boolean;
          rightsRechecked?: boolean;
          payload?: unknown;
          headDigest?: string;
        };
        assert.equal(outcome.tag, 'SameHistoricalFrame');
        assert.equal(outcome.basisRefreshed, false);
        assert.equal(outcome.rightsRechecked, true);
        assert.ok(outcome.payload);
        assert.ok(outcome.headDigest);

        await pool.query(
          `UPDATE ontology.memberships SET state='revoked'
           WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [seeded.worldId, seeded.principalId],
        );
        const afterRevoke = await openFrame(dispatcher, seeded, fx.purpose, createdFrameId);
        assert.equal(afterRevoke.tag, 'NotFoundOrDenied');
        const revokeBlob = JSON.stringify(afterRevoke);
        assert.equal(revokeBlob.includes('"payload"'), false);
        assert.equal(revokeBlob.toLowerCase().includes('http'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0046-NEG', async () => {
    const fx = fixture();
    const disclosure = new FrameDisclosureService();
    const world = { worldId: uuid(randomUUID()), realm: 'live' as const };
    const opaque = disclosure.reopen({
      world,
      frameId: uuid(randomUUID()),
      principalId: uuid(randomUUID()),
      purpose: fx.purpose,
      currentSecurityRevision: '1',
      currentHeadDigest: 'b'.repeat(64),
      sourcesStillAllowed: false,
      membershipActive: true,
    }, null);
    assert.equal(opaque.tag, 'Denied');
    if (opaque.tag === 'Denied') assert.equal(opaque.reason, 'NOT_FOUND_OR_DENIED');
    const opaqueBlob = JSON.stringify(opaque);
    assert.equal(opaqueBlob.includes('payload'), false);
    assert.equal(opaqueBlob.includes('row_count'), false);
    assert.equal(opaqueBlob.includes('exists'), false);
    assert.equal(opaqueBlob.toLowerCase().includes('http'), false);
    assert.equal(opaqueBlob.includes('object_key'), false);

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const stranger = randomUUID();
      await pool.query(
        `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
         VALUES ($1::uuid,'live',$2::uuid,'viewer','active')`,
        [seeded.worldId, stranger],
      );
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const frameId = await inspectFrame(dispatcher, seeded, fx.purpose);
        const denied = await openFrame(dispatcher, seeded, fx.purpose, frameId, stranger);
        assert.equal(denied.tag, 'NotFoundOrDenied');
        const blob = JSON.stringify(denied);
        assert.equal(blob.includes('"payload"'), false);
        assert.equal(blob.includes('row_count'), false);
        assert.equal(blob.toLowerCase().includes('http'), false);
        assert.equal(blob.includes('object_key'), false);
        assert.equal(blob.includes('presign'), false);

        // Unknown opaque ref — same denial shape, no existence metadata.
        const missing = await openFrame(dispatcher, seeded, fx.purpose, randomUUID());
        assert.equal(missing.tag, 'NotFoundOrDenied');
        assert.equal(JSON.stringify(missing).includes('"payload"'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0046-BOUNDARY', async () => {
    const fx = fixture();
    const disclosure = new FrameDisclosureService();
    const world = { worldId: uuid(randomUUID()), realm: 'live' as const };
    const frameId = uuid(randomUUID());
    const principalId = uuid(randomUUID());
    const oldHead = 'c'.repeat(64);
    const newHead = 'd'.repeat(64);
    const row = Object.freeze({
      payload: canonicalJson({ v: 1 }),
      head_digest: oldHead,
      source_ids: [randomUUID()],
      expired: false,
      security_revision_at_pin: '1',
    });

    const inputBase = {
      world,
      frameId,
      principalId,
      purpose: fx.purpose,
      currentSecurityRevision: '2',
      currentHeadDigest: newHead,
      sourcesStillAllowed: true,
      membershipActive: true,
    };

    const first = disclosure.reopen(inputBase, row);
    const second = disclosure.reopen(inputBase, row);
    assert.equal(first.tag, 'NewerFrame');
    assert.equal(second.tag, 'NewerFrame');
    assert.equal(frameDisclosureDigest(first), frameDisclosureDigest(second));
    if (first.tag === 'NewerFrame') {
      assert.equal(first.reason, 'SECURITY_REVISION_ADVANCED');
      assert.equal(first.previousHeadDigest, oldHead);
      assert.equal('payload' in first, false);
    }

    const headOnly = disclosure.reopen({
      ...inputBase,
      currentSecurityRevision: '1',
    }, row);
    assert.equal(headOnly.tag, 'NewerFrame');
    if (headOnly.tag === 'NewerFrame') {
      assert.equal(headOnly.reason, 'HEAD_DIGEST_CHANGED');
    }

    const expired = disclosure.reopen(inputBase, { ...row, expired: true, head_digest: newHead, security_revision_at_pin: '2' });
    assert.equal(expired.tag, 'HistoricalContentUnavailable');
    if (expired.tag === 'HistoricalContentUnavailable') {
      assert.equal(expired.reason, 'FRAME_EXPIRED');
    }

    const invalid = disclosure.reopen({ ...inputBase, purpose: '' }, row);
    assert.equal(invalid.tag, 'Denied');
    if (invalid.tag === 'Denied') assert.equal(invalid.reason, 'INVALID_INPUT');

    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const frameIdPg = await inspectFrame(dispatcher, seeded, fx.purpose);
        // Stale head pin: mutate stored digest so reopen must return NewerFrame, not silent refresh.
        await pool.query(
          `UPDATE ontology.frames SET head_digest=$1
           WHERE world_id=$2::uuid AND frame_id=$3::uuid`,
          ['e'.repeat(64), seeded.worldId, frameIdPg],
        );
        const newer = await openFrame(dispatcher, seeded, fx.purpose, frameIdPg);
        assert.equal(newer.tag, 'Ok');
        if (newer.tag !== 'Ok') throw new Error('newer');
        const outcome = newer.value as { tag: string; reason?: string; payload?: unknown };
        assert.equal(outcome.tag, 'NewerFrame');
        assert.equal(outcome.reason, 'HEAD_DIGEST_CHANGED');
        assert.equal(Object.prototype.hasOwnProperty.call(outcome, 'payload'), false);

        // Duplicate reopen of an unchanged pin stays SameHistoricalFrame (oracle preserved).
        const freshId = await inspectFrame(dispatcher, seeded, fx.purpose);
        const a = await openFrame(dispatcher, seeded, fx.purpose, freshId);
        const b = await openFrame(dispatcher, seeded, fx.purpose, freshId);
        assert.equal(a.tag, 'Ok');
        assert.equal(b.tag, 'Ok');
        if (a.tag === 'Ok' && b.tag === 'Ok') {
          assert.equal((a.value as { tag: string }).tag, 'SameHistoricalFrame');
          assert.equal((b.value as { tag: string }).tag, 'SameHistoricalFrame');
          assert.equal(
            frameDisclosureDigest(a.value as never),
            frameDisclosureDigest(b.value as never),
          );
        }
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0046Tests();
