import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0014-genesis-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/genesis.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/genesis.schema.json');
const AUTHORITY_SQL = join(ROOT, 'db/migrations/0001_authority.sql');
const GENESIS_SQL = join(ROOT, 'db/migrations/zn-0014_genesis.sql');
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0014-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/worlds/genesis.ts'),
        join(ROOT, 'packages/ontology/src/worlds/index.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
      ],
    }),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', env: process.env });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();

type Fixture = { seed: string; seedDigest: string; worldName: string };

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL');
  return url;
}

async function resetAuthority(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DROP SCHEMA IF EXISTS ontology CASCADE;
    DROP SCHEMA IF EXISTS jobs CASCADE;
    DROP SCHEMA IF EXISTS door CASCADE;
  `);
  await pool.query(readFileSync(AUTHORITY_SQL, 'utf8'));
  await pool.query(readFileSync(GENESIS_SQL, 'utf8'));
}

async function registerZn0014Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');

  test('ZN-0014-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const principalId = randomUUID();
      const operationId = randomUUID();
      const input = {
        principalId,
        operationId,
        seedDigest: fx.seedDigest,
        worldName: fx.worldName,
      };

      const [a, b] = await Promise.all([
        createPersonalWorld(pool, input),
        createPersonalWorld(pool, input),
      ]);
      assert.equal(a.tag, 'Ok', JSON.stringify(a));
      assert.equal(b.tag, 'Ok', JSON.stringify(b));
      if (a.tag !== 'Ok' || b.tag !== 'Ok') return;
      assert.equal(a.value.worldId, b.value.worldId);
      assert.equal(a.value.receiptId, b.value.receiptId);
      assert.ok(a.value.replay || b.value.replay, 'at least one concurrent caller should observe replay');

      const worlds = await pool.query('SELECT count(*)::int AS n FROM ontology.worlds');
      const receipts = await pool.query(
        `SELECT count(*)::int AS n FROM ontology.receipts WHERE kind = 'CreatePersonalWorld'`,
      );
      assert.equal(worlds.rows[0].n, 1);
      assert.equal(receipts.rows[0].n, 1);

      const retry = await createPersonalWorld(pool, input);
      assert.equal(retry.tag, 'Ok');
      if (retry.tag === 'Ok') {
        assert.equal(retry.value.replay, true);
        assert.equal(retry.value.worldId, a.value.worldId);
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0014-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const badSeed = await createPersonalWorld(pool, {
        principalId: randomUUID(),
        operationId: randomUUID(),
        seedDigest: 'not-a-digest',
      });
      assert.equal(badSeed.tag, 'InvalidInput');

      const principalId = randomUUID();
      const operationId = randomUUID();
      const first = await createPersonalWorld(pool, {
        principalId,
        operationId,
        seedDigest: fx.seedDigest,
      });
      assert.equal(first.tag, 'Ok');

      const changedIntent = await createPersonalWorld(pool, {
        principalId,
        operationId,
        seedDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      assert.equal(changedIntent.tag, 'Conflict');
      if (changedIntent.tag === 'Conflict') assert.equal(changedIntent.code, 'OPERATION_ID_REUSED');

      const worlds = await pool.query('SELECT count(*)::int AS n FROM ontology.worlds');
      assert.equal(worlds.rows[0].n, 1);
    } finally {
      await pool.end();
    }
  });

  test('ZN-0014-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const principalId = randomUUID();
      const operationId = randomUUID();
      const input = { principalId, operationId, seedDigest: fx.seedDigest };

      // Race many duplicate deliveries
      const results = await Promise.all(
        Array.from({ length: 8 }, () => createPersonalWorld(pool, input)),
      );
      for (const r of results) assert.equal(r.tag, 'Ok', JSON.stringify(r));
      const worldIds = new Set(results.map((r) => (r.tag === 'Ok' ? r.value.worldId : '')));
      assert.equal(worldIds.size, 1);
      const worlds = await pool.query('SELECT count(*)::int AS n FROM ontology.worlds');
      const bootstrap = await pool.query('SELECT count(*)::int AS n FROM ontology.bootstrap_operations');
      assert.equal(worlds.rows[0].n, 1);
      assert.equal(bootstrap.rows[0].n, 1);

      // Different operation id → second world allowed
      const other = await createPersonalWorld(pool, {
        principalId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(other.tag, 'Ok');
      const worlds2 = await pool.query('SELECT count(*)::int AS n FROM ontology.worlds');
      assert.equal(worlds2.rows[0].n, 2);
    } finally {
      await pool.end();
    }
  });
}

await registerZn0014Tests();
