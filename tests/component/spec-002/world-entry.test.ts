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
const FIXTURE_SEED = 'zn-0015-world-entry-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/world-entry.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/world-entry.schema.json');
const AUTHORITY_SQL = join(ROOT, 'db/migrations/0001_authority.sql');
const GENESIS_SQL = join(ROOT, 'db/migrations/zn-0014_genesis.sql');
const ENTRY_SQL = join(ROOT, 'db/migrations/zn-0015_world-entry.sql');
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0015-emit-${process.pid}`);
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
  purposeBilling: string;
  purposeClinical: string;
  audienceHome: string;
  audienceClinic: string;
  grantTtlSeconds: number;
  permitTtlSeconds: number;
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
  `);
  await pool.query(readFileSync(AUTHORITY_SQL, 'utf8'));
  await pool.query(readFileSync(GENESIS_SQL, 'utf8'));
  await pool.query(readFileSync(ENTRY_SQL, 'utf8'));
}

async function registerZn0015Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');
  const {
    openWorld,
    issueRequestPermit,
    authorizeRequestPermit,
    countDomains,
  } = await import('../../../.core-build/packages/ontology/src/worlds/world-entry.js');

  async function genesisWorld(pool: pg.Pool, principalId: string) {
    const fx = fixture();
    const result = await createPersonalWorld(pool, {
      principalId,
      operationId: randomUUID(),
      seedDigest: fx.seedDigest,
      worldName: fx.worldName,
    });
    assert.equal(result.tag, 'Ok', JSON.stringify(result));
    if (result.tag !== 'Ok') throw new Error('genesis failed');
    return result.value;
  }

  test('ZN-0015-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const principalId = randomUUID();
      const world = await genesisWorld(pool, principalId);
      const domainsBefore = await countDomains(pool, world.worldId, 'live');

      const grant = await openWorld(pool, {
        worldId: world.worldId,
        realm: 'live',
        principalId,
        purpose: fx.purposeBilling,
        audience: fx.audienceHome,
        ttlSeconds: fx.grantTtlSeconds,
      });
      assert.equal(grant.tag, 'Ok', JSON.stringify(grant));
      if (grant.tag !== 'Ok') return;

      // Reuse billing grant for clinical.note.read → Denied
      const wrongPurpose = await issueRequestPermit(pool, {
        grantToken: grant.value.grantToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeClinical,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceHome,
        ttlSeconds: fx.permitTtlSeconds,
      });
      assert.equal(wrongPurpose.tag, 'Denied');
      if (wrongPurpose.tag === 'Denied') assert.equal(wrongPurpose.code, 'PURPOSE_MISMATCH');

      const permit = await issueRequestPermit(pool, {
        grantToken: grant.value.grantToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceHome,
        ttlSeconds: fx.permitTtlSeconds,
      });
      assert.equal(permit.tag, 'Ok', JSON.stringify(permit));
      if (permit.tag !== 'Ok') return;

      const okAuth = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceHome,
      });
      assert.equal(okAuth.tag, 'Ok', JSON.stringify(okAuth));

      const alteredBody = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-2' },
        audience: fx.audienceHome,
      });
      assert.equal(alteredBody.tag, 'Denied');
      if (alteredBody.tag === 'Denied') assert.equal(alteredBody.code, 'BODY_DIGEST');

      const wrongRealm = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'evaluation',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceHome,
      });
      assert.ok(wrongRealm.tag === 'Denied' || wrongRealm.tag === 'NotFoundOrDenied', JSON.stringify(wrongRealm));

      const wrongAudience = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceClinic,
      });
      assert.equal(wrongAudience.tag, 'Denied');
      if (wrongAudience.tag === 'Denied') assert.equal(wrongAudience.code, 'AUDIENCE_MISMATCH');

      const expired = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-1' },
        audience: fx.audienceHome,
        now: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000),
      });
      assert.equal(expired.tag, 'Expired');

      const domainsAfter = await countDomains(pool, world.worldId, 'live');
      assert.equal(domainsAfter, domainsBefore, 'deny paths must not write domains');
    } finally {
      await pool.end();
    }
  });

  test('ZN-0015-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const world = await genesisWorld(pool, ownerId);
      const stranger = randomUUID();

      const noMembership = await openWorld(pool, {
        worldId: world.worldId,
        realm: 'live',
        principalId: stranger,
        purpose: fx.purposeBilling,
        audience: fx.audienceHome,
      });
      assert.equal(noMembership.tag, 'Denied');
      if (noMembership.tag === 'Denied') assert.equal(noMembership.code, 'NO_MEMBERSHIP');

      // Revoke owner membership then deny openWorld
      const client = await pool.connect();
      try {
        await client.query("SELECT set_config('zoen.world_id', $1, true)", [world.worldId]);
        await client.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        await client.query(
          `UPDATE ontology.memberships SET state = 'revoked'
           WHERE world_id = $1::uuid AND realm = 'live' AND principal_id = $2::uuid`,
          [world.worldId, ownerId],
        );
      } finally {
        client.release();
      }

      const revoked = await openWorld(pool, {
        worldId: world.worldId,
        realm: 'live',
        principalId: ownerId,
        purpose: fx.purposeBilling,
        audience: fx.audienceHome,
      });
      assert.equal(revoked.tag, 'Denied');
      if (revoked.tag === 'Denied') assert.equal(revoked.code, 'MEMBERSHIP_REVOKED');

      const grants = await pool.query('SELECT count(*)::int AS n FROM ontology.grants');
      // RLS may hide rows without scope; use migrator-style count via new connection with scope
      const scoped = await pool.connect();
      try {
        await scoped.query("SELECT set_config('zoen.world_id', $1, true)", [world.worldId]);
        await scoped.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        const g = await scoped.query('SELECT count(*)::int AS n FROM ontology.grants');
        assert.equal(g.rows[0].n, 0);
        void grants;
      } finally {
        scoped.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0015-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const principalId = randomUUID();
      const world = await genesisWorld(pool, principalId);
      const domainsBefore = await countDomains(pool, world.worldId, 'live');

      const grant = await openWorld(pool, {
        worldId: world.worldId,
        realm: 'live',
        principalId,
        purpose: fx.purposeBilling,
        audience: fx.audienceHome,
      });
      assert.equal(grant.tag, 'Ok');
      if (grant.tag !== 'Ok') return;

      const permit = await issueRequestPermit(pool, {
        grantToken: grant.value.grantToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-boundary' },
        audience: fx.audienceHome,
      });
      assert.equal(permit.tag, 'Ok');
      if (permit.tag !== 'Ok') return;

      // Concurrent identical authorize → deterministic Ok (read-only, no double write)
      const raced = await Promise.all(
        Array.from({ length: 8 }, () =>
          authorizeRequestPermit(pool, {
            permitToken: permit.value.permitToken,
            worldId: world.worldId,
            realm: 'live',
            principalId,
            semanticOp: fx.purposeBilling,
            body: { invoiceId: 'inv-boundary' },
            audience: fx.audienceHome,
          }),
        ),
      );
      for (const r of raced) assert.equal(r.tag, 'Ok', JSON.stringify(r));

      // Advance security revision → Stale at authorize
      const client = await pool.connect();
      try {
        await client.query("SELECT set_config('zoen.world_id', $1, true)", [world.worldId]);
        await client.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        await client.query(
          `UPDATE ontology.worlds SET security_revision = security_revision + 1
           WHERE world_id = $1::uuid AND realm = 'live'`,
          [world.worldId],
        );
      } finally {
        client.release();
      }

      const stale = await authorizeRequestPermit(pool, {
        permitToken: permit.value.permitToken,
        worldId: world.worldId,
        realm: 'live',
        principalId,
        semanticOp: fx.purposeBilling,
        body: { invoiceId: 'inv-boundary' },
        audience: fx.audienceHome,
      });
      assert.equal(stale.tag, 'Stale');
      if (stale.tag === 'Stale') assert.equal(stale.code, 'SECURITY_REVISION');

      const domainsAfter = await countDomains(pool, world.worldId, 'live');
      assert.equal(domainsAfter, domainsBefore);
    } finally {
      await pool.end();
    }
  });
}

await registerZn0015Tests();
