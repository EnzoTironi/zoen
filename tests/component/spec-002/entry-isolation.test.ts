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
const FIXTURE_SEED = 'zn-0018-entry-isolation-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/entry-isolation.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/entry-isolation.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0016_invitations.sql',
  'db/migrations/zn-0017_revocation.sql',
  'db/migrations/zn-0018_entry-isolation.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0018-emit-${process.pid}`);
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
        join(ROOT, 'packages/ontology/src/worlds/world-entry.ts'),
        join(ROOT, 'packages/ontology/src/worlds/invitations.ts'),
        join(ROOT, 'packages/ontology/src/worlds/revocation.ts'),
        join(ROOT, 'packages/ontology/src/worlds/entry-isolation.ts'),
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

type Fixture = {
  seed: string;
  seedDigest: string;
  worldName: string;
  purpose: string;
  audience: string;
  runtimeRoles: string[];
};

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
    DROP SCHEMA IF EXISTS eve CASCADE;
    DROP SCHEMA IF EXISTS channels CASCADE;
  `);
  // Drop roles if exist so migration recreates cleanly (ignore if busy)
  for (const role of ['zoen_authority', 'zoen_door', 'zoen_eve', 'zoen_channel', 'zoen_outbox']) {
    await pool.query(`DROP ROLE IF EXISTS ${role}`);
  }
  for (const sql of SQLS) await pool.query(readFileSync(sql, 'utf8'));
}

async function registerZn0018Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');
  const { probeRoleIsolation, assertRuntimeRoleAttributes, RUNTIME_ROLES } = await import(
    '../../../.core-build/packages/ontology/src/worlds/entry-isolation.js'
  );

  test('ZN-0018-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.deepEqual(fx.runtimeRoles, [...RUNTIME_ROLES]);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const otherOwner = randomUUID();
      const a = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: fx.worldName,
      });
      const b = await createPersonalWorld(pool, {
        principalId: otherOwner,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: 'Other World',
      });
      assert.equal(a.tag, 'Ok');
      assert.equal(b.tag, 'Ok');
      if (a.tag !== 'Ok' || b.tag !== 'Ok') return;

      const report = await probeRoleIsolation(pool, {
        worldId: a.value.worldId,
        otherWorldId: b.value.worldId,
        principalId: ownerId,
        purpose: fx.purpose,
        audience: fx.audience,
      });
      assert.equal(report.tag, 'Ok', JSON.stringify(report));
      if (report.tag !== 'Ok') return;
      assert.equal(report.value.forbiddenDenied, true, report.value.observations.join('|'));
      assert.equal(report.value.legitimateEntryOk, true, report.value.observations.join('|'));
      assert.equal(report.value.noSuperuserRuntime, true);
    } finally {
      await pool.end();
    }
  });

  test('ZN-0018-NEG', async () => {
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const attrs = await assertRuntimeRoleAttributes(pool);
      assert.equal(attrs.tag, 'Ok');

      const client = await pool.connect();
      try {
        await client.query('SET ROLE zoen_door');
        let failed = false;
        try {
          await client.query('CREATE TABLE ontology.pwned(id int)');
        } catch {
          failed = true;
        }
        assert.equal(failed, true);
        await client.query('RESET ROLE');

        await client.query('SET ROLE zoen_eve');
        failed = false;
        try {
          await client.query(
            `INSERT INTO ontology.memberships(world_id, realm, principal_id, role, state)
             VALUES (gen_random_uuid(),'live',gen_random_uuid(),'owner','active')`,
          );
        } catch {
          failed = true;
        }
        assert.equal(failed, true);
        await client.query('RESET ROLE');
      } finally {
        try {
          await client.query('RESET ROLE');
        } catch {
          /* ignore */
        }
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0018-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      // After migration: roles present. Drop schemas and re-apply migrations (fixture restore).
      await resetAuthority(pool);
      const attrs = await assertRuntimeRoleAttributes(pool);
      assert.equal(attrs.tag, 'Ok');

      const ownerId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;

      // Concurrent SET ROLE probes must remain denied (no privilege escalation race)
      const client = await pool.connect();
      try {
        const results = await Promise.all(
          Array.from({ length: 6 }, async () => {
            const c = await pool.connect();
            try {
              await c.query('SET ROLE zoen_channel');
              try {
                await c.query('ALTER TABLE ontology.worlds DISABLE ROW LEVEL SECURITY');
                return 'UNEXPECTED_SUCCESS';
              } catch (error: unknown) {
                const code =
                  typeof error === 'object' && error && 'code' in error
                    ? String((error as { code: string }).code)
                    : 'ERR';
                return code;
              } finally {
                await c.query('RESET ROLE');
              }
            } finally {
              c.release();
            }
          }),
        );
        for (const r of results) assert.notEqual(r, 'UNEXPECTED_SUCCESS', results.join(','));
      } finally {
        client.release();
      }

      // Legitimate entry after restore still works
      const { openWorld } = await import('../../../.core-build/packages/ontology/src/worlds/world-entry.js');
      const entry = await openWorld(pool, {
        worldId: genesis.value.worldId,
        realm: 'live',
        principalId: ownerId,
        purpose: fx.purpose,
        audience: fx.audience,
      });
      assert.equal(entry.tag, 'Ok', JSON.stringify(entry));
    } finally {
      await pool.end();
    }
  });
}

await registerZn0018Tests();
