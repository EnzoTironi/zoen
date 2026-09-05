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
const FIXTURE_SEED = 'zn-0017-revocation-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/revocation.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/revocation.schema.json');
const SQLS = [
  'db/migrations/0001_authority.sql',
  'db/migrations/zn-0014_genesis.sql',
  'db/migrations/zn-0015_world-entry.sql',
  'db/migrations/zn-0016_invitations.sql',
  'db/migrations/zn-0017_revocation.sql',
].map((p) => join(ROOT, p));
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0017-emit-${process.pid}`);
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
  framePurpose: string;
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
  for (const sql of SQLS) await pool.query(readFileSync(sql, 'utf8'));
}

async function registerZn0017Tests(): Promise<void> {
  const { createPersonalWorld } = await import('../../../.core-build/packages/ontology/src/worlds/genesis.js');
  const { createInvitation, acceptInvitation } = await import(
    '../../../.core-build/packages/ontology/src/worlds/invitations.js'
  );
  const {
    revokePrincipal,
    setEmergencyDeny,
    composeFrame,
    finalizeDisclosure,
    countAudit,
  } = await import('../../../.core-build/packages/ontology/src/worlds/revocation.js');

  test('ZN-0017-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const memberId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
        worldName: fx.worldName,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;
      const worldId = genesis.value.worldId;

      const invite = await createInvitation(pool, {
        worldId,
        realm: 'live',
        createdBy: ownerId,
        intendedPrincipalId: memberId,
        role: 'viewer',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      assert.equal(invite.tag, 'Ok');
      if (invite.tag !== 'Ok') return;
      const accepted = await acceptInvitation(pool, {
        invitationToken: invite.value.invitationToken,
        worldId,
        realm: 'live',
        principalId: memberId,
        operationId: randomUUID(),
      });
      assert.equal(accepted.tag, 'Ok');

      const draft = await composeFrame(pool, {
        worldId,
        realm: 'live',
        principalId: memberId,
        purpose: fx.framePurpose,
        payload: { secret: 'billing-summary-should-not-leak' },
      });
      assert.equal(draft.tag, 'Ok', JSON.stringify(draft));
      if (draft.tag !== 'Ok') return;

      const revoked = await revokePrincipal(pool, {
        worldId,
        realm: 'live',
        actorId: ownerId,
        principalId: memberId,
      });
      assert.equal(revoked.tag, 'Ok', JSON.stringify(revoked));

      const final = await finalizeDisclosure(pool, draft.value);
      assert.equal(final.tag, 'Ok', JSON.stringify(final));
      if (final.tag !== 'Ok') return;
      assert.equal(final.value.tag, 'DisclosureSuppressed');
      if (final.value.tag === 'DisclosureSuppressed') {
        assert.equal(final.value.code, 'MEMBERSHIP_REVOKED');
        assert.ok(final.value.auditId);
        assert.equal('payload' in final.value, false);
      }

      const suppressed = await countAudit(pool, worldId, 'live', 'DisclosureSuppressed');
      assert.equal(suppressed, 1);
    } finally {
      await pool.end();
    }
  });

  test('ZN-0017-NEG', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const stranger = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;

      const denied = await revokePrincipal(pool, {
        worldId: genesis.value.worldId,
        realm: 'live',
        actorId: stranger,
        principalId: ownerId,
      });
      assert.equal(denied.tag, 'Denied');

      const draft = await composeFrame(pool, {
        worldId: genesis.value.worldId,
        realm: 'live',
        principalId: stranger,
        purpose: fx.framePurpose,
        payload: { x: 1 },
      });
      assert.equal(draft.tag, 'Denied');
    } finally {
      await pool.end();
    }
  });

  test('ZN-0017-BOUNDARY', async () => {
    const fx = fixture();
    const pool = new pg.Pool({ connectionString: requireDbUrl() });
    try {
      await resetAuthority(pool);
      const ownerId = randomUUID();
      const memberId = randomUUID();
      const genesis = await createPersonalWorld(pool, {
        principalId: ownerId,
        operationId: randomUUID(),
        seedDigest: fx.seedDigest,
      });
      assert.equal(genesis.tag, 'Ok');
      if (genesis.tag !== 'Ok') return;
      const worldId = genesis.value.worldId;

      const invite = await createInvitation(pool, {
        worldId,
        realm: 'live',
        createdBy: ownerId,
        intendedPrincipalId: memberId,
        role: 'editor',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      assert.equal(invite.tag, 'Ok');
      if (invite.tag !== 'Ok') return;
      assert.equal(
        (
          await acceptInvitation(pool, {
            invitationToken: invite.value.invitationToken,
            worldId,
            realm: 'live',
            principalId: memberId,
            operationId: randomUUID(),
          })
        ).tag,
        'Ok',
      );

      const draft = await composeFrame(pool, {
        worldId,
        realm: 'live',
        principalId: memberId,
        purpose: fx.framePurpose,
        payload: { n: 1 },
      });
      assert.equal(draft.tag, 'Ok');
      if (draft.tag !== 'Ok') return;

      const [denyResult, ...finals] = await Promise.all([
        setEmergencyDeny(pool, { worldId, realm: 'live', actorId: ownerId }),
        ...Array.from({ length: 6 }, () => finalizeDisclosure(pool, draft.value)),
      ]);
      assert.equal(denyResult.tag, 'Ok', JSON.stringify(denyResult));
      for (const f of finals) assert.equal(f.tag, 'Ok', JSON.stringify(f));
      const sent = finals.filter((f) => f.tag === 'Ok' && f.value.tag === 'DisclosureSent');
      const suppressed = finals.filter((f) => f.tag === 'Ok' && f.value.tag === 'DisclosureSuppressed');
      assert.ok(sent.length + suppressed.length === finals.length);
      assert.ok(suppressed.length >= 1, 'at least one finalize must observe suppression');
      assert.ok(sent.length <= 1);

      const openAfter = await composeFrame(pool, {
        worldId,
        realm: 'live',
        principalId: ownerId,
        purpose: fx.framePurpose,
        payload: { n: 2 },
      });
      assert.equal(openAfter.tag, 'Denied');
      if (openAfter.tag === 'Denied') assert.equal(openAfter.code, 'EMERGENCY_DENY');
    } finally {
      await pool.end();
    }
  });
}

await registerZn0017Tests();
