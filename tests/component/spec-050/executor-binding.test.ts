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
const FIXTURE_SEED = 'zn-0291-executor-binding-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-050/executor-binding.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-050/executor-binding.schema.json');
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
  const cfgDir = join(tmpdir(), `zn-0291-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/surfaces/executor-binding.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/registry.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/frame-basis.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/discovery.ts'),
        join(ROOT, 'packages/ontology/src/surfaces/frame-disclosure.ts'),
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
        join(ROOT, 'packages/contracts/src/semantic-client.ts'),
        join(ROOT, 'packages/contracts/src/index.ts'),
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
  unit: string;
  billAmountA: string;
  billAmountB: string;
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

function semanticDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

async function registerZn0291Tests(): Promise<void> {
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
    bindSemanticClient,
    webIngress,
    cliIngress,
    opaqueEntryDigest,
  } = await import(
    '../../../.core-build/packages/ontology/src/surfaces/executor-binding.js'
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
    async putImmutable(_world: unknown, evidenceId: string, bytes: Uint8Array, mediaType: string) {
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      return {
        key: `mem/${evidenceId}`,
        sha256,
        size: String(bytes.length),
        mediaType,
        versionId: 'v1',
      };
    },
    async readImmutable() {
      throw new Error('readImmutable not used in ZN-0291 binding path');
    },
  };

  function context(principalId: string, transport: 'web' | 'cli' = 'web') {
    return Object.freeze({
      principalId: uuid(principalId),
      sessionId: 'sess-zn0291',
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

  function stabilizeInspect(v: Record<string, unknown>) {
    const { frameId: _f, ...rest } = v;
    const groups = (rest.groups as { claims?: Record<string, unknown>[]; interpretation?: unknown }[] | undefined)?.map((g) => ({
      interpretation: g.interpretation,
      claimValues: (g.claims ?? [])
        .map((c) => ({
          predicateId: c.predicateId,
          value: c.value,
          unit: c.unit,
          verification: c.verification,
          validTime: c.validTime,
          sourceId: c.sourceId,
        }))
        .sort((x, y) => String(x.value).localeCompare(String(y.value))),
    }));
    return { gaps: rest.gaps, subject: rest.subject, basis: rest.basis, groups };
  }

  function makeBinding(dbUrl: string, releaseDigest: string, witnesses: unknown[] = []) {
    const db = new PgDatabase({ connectionString: dbUrl });
    const clock = { now: () => new Date().toISOString() };
    const authority = new Authority(db, testCrypto, clock, testAuthorizer, releaseDigest);
    const executor = new SemanticExecutor(authority, evidenceStore, releaseDigest);
    const dispatcher = new SemanticDispatcher(executor, releaseDigest);
    const client = bindSemanticClient(dispatcher, releaseDigest, {
      witnessSink: (w) => {
        witnesses.push(w);
      },
    });
    return { db, dispatcher, client, witnesses };
  }

  function mutationData<T extends Record<string, unknown>>(result: { tag: string; value?: unknown }): T {
    assert.equal(result.tag, 'Ok', JSON.stringify(result));
    const outer = result.value as { data?: T } & T;
    if (outer && typeof outer === 'object' && outer.data && typeof outer.data === 'object') {
      return outer.data as T;
    }
    return outer as T;
  }

  test('ZN-0291-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    const witnesses: unknown[] = [];
    try {
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'Executor Binding World',
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
      const { db, client } = makeBinding(requireDbUrl(), releaseDigest, witnesses);
      try {
        const worldRef = { worldId, realm: 'live' };
        const ctxWeb = context(principalId, 'web');
        const ctxCli = context(principalId, 'cli');

        const subjectRes = await webIngress(
          client,
          envelopeBytes({
            schemaVersion: 1,
            operation: 'CreateSubject',
            operationId: randomUUID(),
            worldRef,
            purpose: fx.purpose,
            expectedBasis: null,
            input: { typeId: 'record', label: fx.subjectLabel },
          }),
          ctxWeb,
        );
        const subjectId = mutationData<{ subjectId: string }>(subjectRes).subjectId;

        async function registerAndStage(name: string, content: string, amount: string, date: string) {
          const src = await cliIngress(
            client,
            envelopeBytes({
              schemaVersion: 1,
              operation: 'RegisterSource',
              operationId: randomUUID(),
              worldRef,
              purpose: fx.purpose,
              expectedBasis: null,
              input: { name, visibility: 'shared' },
            }),
            ctxCli,
          );
          const sourceId = mutationData<{ sourceId: string }>(src).sourceId;
          const evidenceOpId = randomUUID();
          const staged = await webIngress(
            client,
            envelopeBytes({
              schemaVersion: 1,
              operation: 'StageEvidence',
              operationId: evidenceOpId,
              worldRef,
              purpose: fx.purpose,
              expectedBasis: null,
              input: { sourceId, mediaType: 'text/plain', content },
            }),
            ctxWeb,
          );
          const evidenceId = mutationData<{ evidenceId: string }>(staged).evidenceId;
          const admitted = await cliIngress(
            client,
            envelopeBytes({
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
            }),
            ctxCli,
          );
          assert.equal(admitted.tag, 'Ok', JSON.stringify(admitted));
          return { sourceId, evidenceId };
        }

        await registerAndStage('bill-a', `bill A ${fx.billAmountA}`, fx.billAmountA, fx.sourceDateA);
        await registerAndStage('bill-b', `bill B ${fx.billAmountB}`, fx.billAmountB, fx.sourceDateB);

        const inspectDigest = contractDigestFor('Inspect', releaseDigest);
        const inspectBody = {
          schemaVersion: 1,
          operation: 'Inspect',
          operationId: randomUUID(),
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: { subjectId, predicateId: 'record.amount' },
        };
        const beforeWitness = witnesses.length;
        const webInspect = await webIngress(
          client,
          envelopeBytes({ ...inspectBody, operationId: randomUUID() }),
          ctxWeb,
          inspectDigest,
        );
        const cliInspect = await cliIngress(
          client,
          envelopeBytes({ ...inspectBody, operationId: randomUUID() }),
          ctxCli,
          inspectDigest,
        );
        assert.equal(webInspect.tag, 'Ok', JSON.stringify(webInspect));
        assert.equal(cliInspect.tag, 'Ok', JSON.stringify(cliInspect));
        if (webInspect.tag !== 'Ok' || cliInspect.tag !== 'Ok') throw new Error('inspect');

        const webStable = stabilizeInspect(webInspect.value as Record<string, unknown>);
        const cliStable = stabilizeInspect(cliInspect.value as Record<string, unknown>);
        assert.equal(semanticDigest(webStable), semanticDigest(cliStable));
        assert.ok(Array.isArray(webStable.groups) && webStable.groups.length >= 1);
        // Rival / contested authorized records under equal basis
        const claimValues = (webStable.groups ?? []).flatMap((g) => g.claimValues ?? []);
        const amounts = new Set(claimValues.map((c) => String(c.value)));
        const normalized = new Set([...amounts].map((a) => a.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')));
        const wantA = fx.billAmountA.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        const wantB = fx.billAmountB.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        assert.ok(normalized.has(wantA) && normalized.has(wantB), `expected ${wantA}/${wantB}, got ${[...amounts]}`);
        const interpretations = (webInspect.value as { groups?: { interpretation?: { rivalRefs?: string[]; contested?: boolean; values?: string[] } }[] }).groups ?? [];
        const rivals = interpretations.flatMap((g) => g.interpretation?.rivalRefs ?? []);
        const contested = interpretations.some((g) => g.interpretation?.contested === true || (g.interpretation?.rivalRefs?.length ?? 0) > 0 || (g.interpretation?.values?.length ?? 0) > 1);
        assert.ok(contested || rivals.length > 0 || amounts.size >= 2, 'expected rival/contested interpretation');
        assert.ok(webStable.basis !== undefined && webStable.basis !== null);
        assert.equal(webInspect.tag, cliInspect.tag);

        const inspectWitnesses = (witnesses.slice(beforeWitness) as Array<{
          operation: string;
          enteredDispatch: boolean;
          modelInvoked: boolean;
          surface: string;
        }>).filter((w) => w.operation === 'Inspect');
        assert.equal(inspectWitnesses.length, 2);
        assert.ok(inspectWitnesses.every((w) => w.enteredDispatch === true && w.modelInvoked === false));
        assert.deepEqual(
          new Set(inspectWitnesses.map((w) => w.surface)),
          new Set(['web', 'cli']),
        );
        for (const w of inspectWitnesses) {
          assert.match(opaqueEntryDigest(w as never), /^[a-f0-9]{64}$/);
        }
        assert.equal(JSON.stringify(webInspect).toLowerCase().includes('llm'), false);
        assert.equal(JSON.stringify(webInspect).toLowerCase().includes('openai'), false);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0291-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'Executor Binding Neg',
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') throw new Error('genesis');
      const worldId = genesis.value.worldId as string;
      const rel = await pool.query<{ release_digest: string }>(
        `SELECT release_digest FROM ontology.worlds WHERE world_id=$1::uuid`,
        [worldId],
      );
      const releaseDigest = rel.rows[0]!.release_digest;
      const { db, client } = makeBinding(requireDbUrl(), releaseDigest);
      try {
        const framesBefore = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.frames WHERE world_id=$1::uuid`,
          [worldId],
        );
        const subjectsBefore = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.subjects WHERE world_id=$1::uuid`,
          [worldId],
        );
        const ctx = context(principalId, 'web');
        const body = envelopeBytes({
          schemaVersion: 1,
          operation: 'Inspect',
          operationId: randomUUID(),
          worldRef: { worldId, realm: 'live' },
          purpose: fx.purpose,
          expectedBasis: null,
          input: { subjectId: randomUUID() },
        });

        const principalDenied = await client.call(
          { surface: 'web', envelopeBytes: body, clientPrincipalId: randomUUID() },
          ctx,
        );
        assert.equal(principalDenied.tag, 'Denied');
        if (principalDenied.tag !== 'Ok') assert.equal(principalDenied.code, 'CLIENT_PRINCIPAL_FORBIDDEN');

        const sqlDenied = await client.call(
          { surface: 'cli', envelopeBytes: body, rawSql: 'SELECT * FROM ontology.claims' },
          context(principalId, 'cli'),
        );
        assert.equal(sqlDenied.tag, 'Denied');
        if (sqlDenied.tag !== 'Ok') assert.equal(sqlDenied.code, 'RAW_SQL_FORBIDDEN');

        const urlDenied = await client.call(
          { surface: 'web', envelopeBytes: body, sourceUrl: 'https://evil.example/dump.csv' },
          ctx,
        );
        assert.equal(urlDenied.tag, 'Denied');
        if (urlDenied.tag !== 'Ok') assert.equal(urlDenied.code, 'SOURCE_URL_FORBIDDEN');

        const framesAfter = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.frames WHERE world_id=$1::uuid`,
          [worldId],
        );
        const subjectsAfter = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ontology.subjects WHERE world_id=$1::uuid`,
          [worldId],
        );
        assert.equal(framesAfter.rows[0]?.n, framesBefore.rows[0]?.n);
        assert.equal(subjectsAfter.rows[0]?.n, subjectsBefore.rows[0]?.n);
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0291-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetDb(pool);
      const principalId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'Executor Binding Boundary',
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
      const { db, client } = makeBinding(requireDbUrl(), releaseDigest);
      try {
        const worldRef = { worldId, realm: 'live' };
        const opId = randomUUID();
        const body = {
          schemaVersion: 1,
          operation: 'Discover',
          operationId: opId,
          worldRef,
          purpose: fx.purpose,
          expectedBasis: null,
          input: {},
        };
        const digest = contractDigestFor('Discover', releaseDigest);
        // Same identity across surfaces — not a new idempotency namespace
        const first = await webIngress(
          client,
          envelopeBytes(body),
          context(principalId, 'web'),
          digest,
        );
        const second = await cliIngress(
          client,
          envelopeBytes(body),
          context(principalId, 'cli'),
          digest,
        );
        assert.equal(first.tag, 'Ok', JSON.stringify(first));
        assert.equal(second.tag, 'Ok', JSON.stringify(second));
        if (first.tag === 'Ok' && second.tag === 'Ok') {
          assert.equal(semanticDigest(first.value), semanticDigest(second.value));
        }
        // Distinct operationId is a new intention
        const third = await webIngress(
          client,
          envelopeBytes({ ...body, operationId: randomUUID() }),
          context(principalId, 'web'),
          digest,
        );
        assert.equal(third.tag, 'Ok');
      } finally {
        await db.close();
      }
    } finally {
      await pool.end();
    }
  });
}

await registerZn0291Tests();
