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
const FIXTURE_SEED = 'zn-0016-invitations-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/invitations.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/invitations.schema.json');
const AUTHORITY_SQL = join(ROOT, 'db/migrations/0001_authority.sql');
const GENESIS_SQL = join(ROOT, 'db/migrations/zn-0014_genesis.sql');
const ENTRY_SQL = join(ROOT, 'db/migrations/zn-0015_world-entry.sql');
const INVITE_SQL = join(ROOT, 'db/migrations/zn-0016_invitations.sql');
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0016-emit-${process.pid}`);
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
  inviteRole: 'viewer' | 'editor';
  claimPredicate: string;
  claimLabel: string;
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
  await pool.query(readFileSync(INVITE_SQL, 'utf8'));
}

async function registerZn0016Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');
  const {
    createInvitation,
    acceptInvitation,
    plantClaim,
    readWorldHead,
  } = await import('../../../.core-build/packages/ontology/src/worlds/invitations.js');

  test('ZN-0016-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const intended = randomUUID();
      const stranger = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: fx.worldName,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;
      const worldId = genesis.value.worldId;

      await plantClaim(pool, {
        worldId,
        realm: 'live',
        principalId: ownerId,
        predicateId: fx.claimPredicate,
        label: fx.claimLabel,
      });
      const before = await readWorldHead(pool, worldId, 'live');
      assert.equal(before.claimCount, 1);

      const invite = await createInvitation(pool, {
        worldId,
        realm: 'live',
        createdBy: ownerId,
        intendedPrincipalId: intended,
        role: fx.inviteRole,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      assert.equal(invite.tag, 'Ok', JSON.stringify(invite));
      if (invite.tag !== 'Ok') return;

      const opIntended = randomUUID();
      const opStranger = randomUUID();
      const [a, b] = await Promise.all([
        acceptInvitation(pool, {
          invitationToken: invite.value.invitationToken,
          worldId,
          realm: 'live',
          principalId: intended,
          operationId: opIntended,
        }),
        acceptInvitation(pool, {
          invitationToken: invite.value.invitationToken,
          worldId,
          realm: 'live',
          principalId: stranger,
          operationId: opStranger,
        }),
      ]);

      const tags = [a.tag, b.tag].sort();
      assert.deepEqual(tags, ['Denied', 'Ok']);
      const okResult = a.tag === 'Ok' ? a : b.tag === 'Ok' ? b : null;
      const denied = a.tag === 'Denied' ? a : b.tag === 'Denied' ? b : null;
      assert.ok(okResult && denied);
      if (okResult?.tag === 'Ok') assert.equal(okResult.value.principalId, intended);
      if (denied && 'code' in denied) assert.equal(denied.code, 'INVITATION_NOT_INTENDED');

      const after = await readWorldHead(pool, worldId, 'live');
      assert.equal(after.releaseDigest, before.releaseDigest);
      assert.equal(after.generationId, before.generationId);
      assert.equal(after.claimCount, before.claimCount);

      const members = await pool.connect();
      try {
        await members.query("SELECT set_config('zoen.world_id', $1, true)", [worldId]);
        await members.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        const rows = await members.query(
          `SELECT principal_id::text, role, state FROM ontology.memberships ORDER BY role, principal_id`,
        );
        assert.equal(rows.rows.length, 2);
        assert.ok(rows.rows.some((r) => r.principal_id === intended && r.role === fx.inviteRole));
        assert.ok(!rows.rows.some((r) => r.principal_id === stranger));
      } finally {
        members.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0016-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const intended = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;

      const invite = await createInvitation(pool, {
        worldId: genesis.value.worldId,
        realm: 'live',
        createdBy: ownerId,
        intendedPrincipalId: intended,
        role: 'viewer',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      assert.equal(invite.tag, 'Ok');
      if (invite.tag !== 'Ok') return;

      const wrong = await acceptInvitation(pool, {
        invitationToken: invite.value.invitationToken,
        worldId: genesis.value.worldId,
        realm: 'live',
        principalId: randomUUID(),
        operationId: randomUUID(),
      });
      assert.equal(wrong.tag, 'Denied');

      const expired = await acceptInvitation(pool, {
        invitationToken: invite.value.invitationToken,
        worldId: genesis.value.worldId,
        realm: 'live',
        principalId: intended,
        operationId: randomUUID(),
        now: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000),
      });
      assert.equal(expired.tag, 'Expired');

      // still unconsumed
      const client = await pool.connect();
      try {
        await client.query("SELECT set_config('zoen.world_id', $1, true)", [genesis.value.worldId]);
        await client.query("SELECT set_config('zoen.realm', $1, true)", ['live']);
        const inv = await client.query(
          `SELECT consumed_by FROM ontology.invitations WHERE invitation_hash = $1`,
          [invite.value.invitationHash],
        );
        assert.equal(inv.rows[0].consumed_by, null);
        const mem = await client.query(
          `SELECT count(*)::int AS n FROM ontology.memberships WHERE principal_id = $1::uuid`,
          [intended],
        );
        assert.equal(mem.rows[0].n, 0);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('ZN-0016-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const intended = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;
      const worldId = genesis.value.worldId;
      await plantClaim(pool, {
        worldId,
        realm: 'live',
        principalId: ownerId,
        predicateId: fx.claimPredicate,
        label: fx.claimLabel,
      });
      const before = await readWorldHead(pool, worldId, 'live');

      const invite = await createInvitation(pool, {
        worldId,
        realm: 'live',
        createdBy: ownerId,
        intendedPrincipalId: intended,
        role: 'editor',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      assert.equal(invite.tag, 'Ok');
      if (invite.tag !== 'Ok') return;

      const operationId = randomUUID();
      const raced = await Promise.all(
        Array.from({ length: 8 }, () =>
          acceptInvitation(pool, {
            invitationToken: invite.value.invitationToken,
            worldId,
            realm: 'live',
            principalId: intended,
            operationId,
          }),
        ),
      );
      for (const r of raced) assert.equal(r.tag, 'Ok', JSON.stringify(r));
      const receiptIds = new Set(raced.map((r) => (r.tag === 'Ok' ? r.value.receiptId : '')));
      assert.equal(receiptIds.size, 1);
      assert.ok(raced.some((r) => r.tag === 'Ok' && r.value.replay === true));

      const after = await readWorldHead(pool, worldId, 'live');
      assert.equal(after.releaseDigest, before.releaseDigest);
      assert.equal(after.generationId, before.generationId);
      assert.equal(after.claimCount, before.claimCount);

      // Second distinct operationId against consumed invite → Conflict
      const second = await acceptInvitation(pool, {
        invitationToken: invite.value.invitationToken,
        worldId,
        realm: 'live',
        principalId: intended,
        operationId: randomUUID(),
      });
      assert.equal(second.tag, 'Conflict');
    } finally {
      await pool.end();
    }
  });
}

await registerZn0016Tests();
