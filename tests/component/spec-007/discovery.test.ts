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
const FIXTURE_SEED = 'zn-0044-discovery-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-007/discovery.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-007/discovery.schema.json');
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
  const cfgDir = join(tmpdir(), `zn-0044-emit-${process.pid}`);
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
  clinicalFieldId: string;
  sharedFieldId: string;
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

async function registerZn0044Tests(): Promise<void> {
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
    DiscoveryService,
    discoveryLeakScan,
    buildOpaqueEvidenceRef,
    asMembership,
    DISCOVERY_FIELDS,
  } = await import('../../../.core-build/packages/ontology/src/surfaces/discovery.js');
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

  /** Role-aware authorizer: owner-only sensitivity denied for viewers (receptionist). */
  const roleAuthorizer = {
    async authorize(
      _context: unknown,
      _operation: unknown,
      resource: { sensitivity: string },
      membership: { role: string; state: string },
      _purpose: string,
    ) {
      if (membership.state !== 'active') return false;
      if (resource.sensitivity === 'owner-only') {
        return membership.role === 'owner' || membership.role === 'editor';
      }
      return true;
    },
  };

  const evidenceStore = {
    async putImmutable() {
      throw new Error('evidence store unused in discovery path');
    },
    async readImmutable() {
      throw new Error('evidence store unused in discovery path');
    },
  };

  function context(principalId: string, transport: 'web' | 'cli' = 'web') {
    return Object.freeze({
      principalId: uuid(principalId),
      sessionId: 'sess-zn0044',
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
    const clinicianId = randomUUID();
    const genesis = await createPersonalWorld(pool, {
      principalId: clinicianId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
      worldName: 'Discovery World',
    });
    assert.equal(genesis.tag, 'Ok');
    if (genesis.tag !== 'Ok') throw new Error('genesis');
    const worldId = genesis.value.worldId as string;
    const receptionistId = randomUUID();
    await pool.query(
      `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
       VALUES ($1::uuid,'live',$2::uuid,'viewer','active')`,
      [worldId, receptionistId],
    );
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
    const sharedSource = randomUUID();
    const clinicalSource = randomUUID();
    await pool.query(
      `INSERT INTO ontology.sources(world_id, realm, source_id, family_id, name, visibility, created_by)
       VALUES
         ($1::uuid,'live',$2::uuid,$3::uuid,'shared-bill','shared',$4::uuid),
         ($1::uuid,'live',$5::uuid,$6::uuid,'clinical-chart','owner-only',$4::uuid)`,
      [worldId, sharedSource, randomUUID(), clinicianId, clinicalSource, randomUUID()],
    );
    const sharedEvidence = randomUUID();
    const clinicalEvidence = randomUUID();
    const digShared = 'a'.repeat(64);
    const digClinical = 'b'.repeat(64);
    await pool.query(
      `INSERT INTO ontology.evidence(world_id, realm, evidence_id, source_id, object_key, content_digest, size_bytes, media_type, object_version)
       VALUES
         ($1::uuid,'live',$2::uuid,$3::uuid,'obj/shared',$6,1,'text/plain','v1'),
         ($1::uuid,'live',$4::uuid,$5::uuid,'obj/clinical',$7,1,'text/plain','v1')`,
      [worldId, sharedEvidence, sharedSource, clinicalEvidence, clinicalSource, digShared, digClinical],
    );
    const rel = await pool.query<{ release_digest: string; security_revision: string }>(
      `SELECT release_digest, security_revision::text FROM ontology.worlds WHERE world_id=$1::uuid`,
      [worldId],
    );
    return {
      clinicianId,
      receptionistId,
      worldId,
      subjectId,
      sharedSource,
      clinicalSource,
      sharedEvidence,
      clinicalEvidence,
      releaseDigest: rel.rows[0]!.release_digest,
      securityRevision: rel.rows[0]!.security_revision,
    };
  }

  function makeDispatcher(dbUrl: string, releaseDigest: string) {
    const db = new PgDatabase({ connectionString: dbUrl });
    const clock = { now: () => new Date().toISOString() };
    const authority = new Authority(db, testCrypto, clock, roleAuthorizer, releaseDigest);
    const executor = new SemanticExecutor(authority, evidenceStore, releaseDigest);
    const dispatcher = new SemanticDispatcher(executor, releaseDigest);
    return { db, dispatcher, authority };
  }

  test('ZN-0044-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(
      createHash('sha256').update(fx.seed, 'utf8').digest('hex'),
      fx.seedDigest,
    );
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const digest = contractDigestFor('Discover', seeded.releaseDigest);
        const bodyBase = {
          schemaVersion: 1,
          operation: 'Discover',
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: {},
        };

        const clinician = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({ ...bodyBase, operationId: randomUUID() }),
            expectedContractDigest: digest,
          },
          context(seeded.clinicianId, 'web'),
        );
        assert.equal(clinician.tag, 'Ok');
        if (clinician.tag !== 'Ok') throw new Error('clinician discover');
        const clinVal = clinician.value as {
          fields: { id: string }[];
          explanations: unknown[];
          operations: unknown[];
        };
        const clinFieldIds = clinVal.fields.map((f) => f.id);
        assert.ok(clinFieldIds.includes(fx.clinicalFieldId));
        assert.ok(clinFieldIds.includes(fx.sharedFieldId));
        assert.ok(clinVal.explanations.length > 0);
        assert.ok(clinVal.operations.length > 0);

        const receptionist = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes({ ...bodyBase, operationId: randomUUID() }),
            expectedContractDigest: digest,
          },
          context(seeded.receptionistId, 'cli'),
        );
        assert.equal(receptionist.tag, 'Ok');
        if (receptionist.tag !== 'Ok') throw new Error('receptionist discover');
        const recvVal = receptionist.value as {
          fields: { id: string; schema?: unknown }[];
          explanations: { fieldId: string; text: string }[];
          operations: unknown[];
        };
        const recvFieldIds = recvVal.fields.map((f) => f.id);
        assert.ok(recvFieldIds.includes(fx.sharedFieldId));
        assert.equal(recvFieldIds.includes(fx.clinicalFieldId), false);

        const leaks = discoveryLeakScan(receptionist.value, [fx.clinicalFieldId], [seeded.clinicalEvidence]);
        assert.deepEqual(leaks, []);
        // schemas / counts / examples / error detail must not leak clinical field
        const blob = JSON.stringify(receptionist.value).toLowerCase();
        assert.equal(blob.includes('clinical_note'), false);
        assert.equal(blob.includes(seeded.clinicalEvidence.toLowerCase()), false);
        assert.equal(blob.includes('row_count'), false);
        assert.equal(blob.includes('http://'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0044-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const digest = contractDigestFor('Discover', seeded.releaseDigest);
        // Opaque clinical evidence ref resolved as receptionist — identical denial, no leak
        const clinicalRef = buildOpaqueEvidenceRef(seeded.worldId, seeded.clinicalEvidence);
        const denied = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({
              schemaVersion: 1,
              operation: 'Discover',
              operationId: randomUUID(),
              worldRef: { worldId: seeded.worldId, realm: 'live' },
              purpose: fx.purpose,
              expectedBasis: null,
              input: { explainOpaqueRef: clinicalRef },
            }),
            expectedContractDigest: digest,
          },
          context(seeded.receptionistId, 'web'),
        );
        assert.equal(denied.tag, 'NotFoundOrDenied');
        const blob = JSON.stringify(denied);
        assert.equal(blob.toLowerCase().includes('http'), false);
        assert.equal(blob.includes('object_key'), false);
        assert.equal(blob.includes('row_count'), false);
        assert.equal(blob.includes(seeded.clinicalEvidence), false);
        assert.equal(blob.includes('exists'), false);

        // Completely unknown opaque ref — same tag/shape
        const missing = await dispatcher.invoke(
          {
            transport: 'cli',
            envelopeBytes: envelopeBytes({
              schemaVersion: 1,
              operation: 'Discover',
              operationId: randomUUID(),
              worldRef: { worldId: seeded.worldId, realm: 'live' },
              purpose: fx.purpose,
              expectedBasis: null,
              input: { explainOpaqueRef: `zoen:disc:ev:${seeded.worldId}:${randomUUID()}` },
            }),
            expectedContractDigest: digest,
          },
          context(seeded.receptionistId, 'cli'),
        );
        assert.equal(missing.tag, 'NotFoundOrDenied');
        assert.equal(missing.tag, denied.tag);
        if (missing.tag !== 'Ok' && denied.tag !== 'Ok') {
          assert.equal(missing.code, denied.code);
        }

        // Direct service path: unauthorized opaque ref
        const svc = new DiscoveryService();
        const emptyMap = new Map();
        const direct = await svc.explainOpaqueRef({
          world: { worldId: uuid(seeded.worldId), realm: 'live' },
          context: context(seeded.receptionistId),
          membership: asMembership(seeded.receptionistId, 'viewer'),
          purpose: fx.purpose,
          opaqueRef: clinicalRef,
          authorizedByRef: emptyMap,
        });
        assert.equal(direct.tag, 'Denied');
        if (direct.tag === 'Denied') assert.equal(direct.reason, 'NOT_FOUND_OR_DENIED');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0044-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const seeded = await seedWorld(pool, fx);
      const { db, dispatcher } = makeDispatcher(requireDbUrl(), seeded.releaseDigest);
      try {
        const digest = contractDigestFor('Discover', seeded.releaseDigest);
        const body = {
          schemaVersion: 1,
          operation: 'Discover',
          worldRef: { worldId: seeded.worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: {},
        };
        // Duplicate / reordered concurrent discovers
        const raced = await Promise.all([
          dispatcher.invoke(
            { transport: 'web', envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }), expectedContractDigest: digest },
            context(seeded.clinicianId, 'web'),
          ),
          dispatcher.invoke(
            { transport: 'cli', envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }), expectedContractDigest: digest },
            context(seeded.receptionistId, 'cli'),
          ),
        ]);
        assert.equal(raced[0]!.tag, 'Ok');
        assert.equal(raced[1]!.tag, 'Ok');
        if (raced[0]!.tag === 'Ok' && raced[1]!.tag === 'Ok') {
          const clinFields = (raced[0]!.value as { fields: { id: string }[] }).fields.map((f) => f.id);
          const recvFields = (raced[1]!.value as { fields: { id: string }[] }).fields.map((f) => f.id);
          assert.ok(clinFields.includes(fx.clinicalFieldId));
          assert.equal(recvFields.includes(fx.clinicalFieldId), false);
        }

        // Revoked receptionist
        await pool.query(
          `UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1::uuid AND principal_id=$2::uuid`,
          [seeded.worldId, seeded.receptionistId],
        );
        const revoked = await dispatcher.invoke(
          {
            transport: 'web',
            envelopeBytes: envelopeBytes({ ...body, operationId: randomUUID() }),
            expectedContractDigest: digest,
          },
          context(seeded.receptionistId, 'web'),
        );
        assert.equal(revoked.tag, 'NotFoundOrDenied');

        // Profile limit at DiscoveryService boundary — unsupported oversize
        const svc = new DiscoveryService();
        const over = await svc.discover({
          world: { worldId: uuid(seeded.worldId), realm: 'live' },
          context: context(seeded.clinicianId),
          membership: asMembership(seeded.clinicianId, 'owner'),
          purpose: fx.purpose,
          releaseDigest: seeded.releaseDigest,
          securityRevision: seeded.securityRevision,
          sourceAclFreshness: seeded.securityRevision,
          authorizedEvidence: [],
          authorizer: roleAuthorizer,
          fieldLimit: 10_000,
        });
        assert.equal(over.tag, 'Denied');
        if (over.tag === 'Denied') assert.equal(over.reason, 'UNSUPPORTED_LIMIT');

        // Incomplete rather than silent truncation when under hard cap
        const limited = await svc.discover({
          world: { worldId: uuid(seeded.worldId), realm: 'live' },
          context: context(seeded.clinicianId),
          membership: asMembership(seeded.clinicianId, 'owner'),
          purpose: fx.purpose,
          releaseDigest: seeded.releaseDigest,
          securityRevision: seeded.securityRevision,
          sourceAclFreshness: seeded.securityRevision,
          authorizedEvidence: [],
          authorizer: roleAuthorizer,
          fieldLimit: 2,
        });
        assert.equal(limited.tag, 'Ok');
        if (limited.tag === 'Ok') {
          assert.equal(limited.value.incomplete, true);
          assert.equal(limited.value.fields.length, 2);
          assert.ok(DISCOVERY_FIELDS.length > 2);
        }
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0044Tests();
