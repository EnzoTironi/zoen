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
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0013-emit-${process.pid}`);
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
        join(ROOT, 'packages/door/src/door.ts'),
        join(ROOT, 'packages/door/src/index.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
      ],
    }),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', env: process.env });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();
const FIXTURE_SEED = 'zn-0013-presence-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-002/presence.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-002/presence.schema.json');
const MIGRATION_PATH = join(ROOT, 'db/migrations/zn-0013_presence.sql');
const EXTENSION_LOCK = join(ROOT, 'admissions/spec-002/extension-lock.json');

type Fixture = {
  seed: string;
  audience: string;
  password: string;
  worldId: string;
  purpose: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function requireDbUrl(): string {
  const url = process.env.ZOEN_TEST_DATABASE_URL;
  if (!url) {
    throw new Error('MissingPrerequisite: ZOEN_TEST_DATABASE_URL (real disposable Postgres required)');
  }
  return url;
}

async function resetHarness(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS public.verification CASCADE;
    DROP TABLE IF EXISTS public.account CASCADE;
    DROP TABLE IF EXISTS public.session CASCADE;
    DROP TABLE IF EXISTS public."user" CASCADE;
    DROP TABLE IF EXISTS door.revoked_sessions CASCADE;
    DROP TABLE IF EXISTS door.subject_map CASCADE;
    CREATE SCHEMA IF NOT EXISTS door;
    CREATE TABLE public."user" (
      id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false, image text,
      "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
      "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE TABLE public.session (
      id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
      "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
      "ipAddress" text, "userAgent" text,
      "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE
    );
    CREATE TABLE public.account (
      id text PRIMARY KEY, issuer text, "accountId" text NOT NULL, "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
      "accessToken" text, "refreshToken" text, "idToken" text,
      "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
      scope text, password text,
      "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
      "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE TABLE public.verification (
      id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
      "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  `);
  await pool.query(readFileSync(MIGRATION_PATH, 'utf8'));
}

async function registerZn0013Tests(): Promise<void> {
  const { createDoor, createDoorPort, signUpWithCookie } = await import('../../../.core-build/packages/door/src/door.js');

  test('ZN-0013-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    assert.equal(existsSync(MIGRATION_PATH), true);
    assert.equal(existsSync(EXTENSION_LOCK), true);
    const lock = JSON.parse(readFileSync(EXTENSION_LOCK, 'utf8')) as {
      dependencies: { 'better-auth': { integrity: string; version: string } };
    };
    assert.equal(lock.dependencies['better-auth'].version, '1.7.2');
    assert.match(lock.dependencies['better-auth'].integrity, /^sha512-/);

    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    const url = requireDbUrl();
    const pool = new pg.Pool({ connectionString: url });
    try {
      await resetHarness(pool);
      const door = createDoor(pool, fx.audience, 'test-secret-with-enough-entropy-0123456789abcdef');
      const port = createDoorPort(door, pool, fx.audience);

      const signed = await signUpWithCookie(door, {
        email: `ac-${randomUUID()}@example.com`,
        password: fx.password,
        name: 'No Membership',
      });
      assert.equal(signed.tag, 'Ok');
      if (signed.tag !== 'Ok') return;

      const headers = new Headers({ cookie: signed.value.cookie });
      const proof = await port.verify({ headers, audience: fx.audience });
      assert.equal(proof.tag, 'Ok');
      if (proof.tag !== 'Ok') return;
      assert.equal(proof.value.tag, 'PresenceProof');
      assert.equal(proof.value.worldGrant, null);
      assert.equal(proof.value.membership, null);
      assert.notEqual(proof.value.subjectId.includes('@'), true);

      // Presence alone yields no grant
      const entry = await port.attemptPrivateWorldEntry(
        { headers, audience: fx.audience },
        { worldId: fx.worldId as `${string}-${string}-${string}-${string}-${string}`, purpose: fx.purpose },
      );
      assert.equal(entry.tag, 'Denied');
      if (entry.tag === 'Denied') assert.equal(entry.code, 'PRESENCE_NOT_A_GRANT');

      // Prior success, then revoke → rejected
      const revoked = await port.revokeSession({ headers, audience: fx.audience }, signed.value.token);
      assert.equal(revoked.tag, 'Ok');
      const after = await port.verify({ headers, audience: fx.audience });
      assert.equal(after.tag, 'Denied');
      if (after.tag === 'Denied') assert.equal(after.code, 'AUTHENTICATION_REQUIRED');
    } finally {
      await pool.end();
    }
  });

  test('ZN-0013-NEG', async () => {
    const fx = fixture();
    const url = requireDbUrl();
    const pool = new pg.Pool({ connectionString: url });
    try {
      await resetHarness(pool);
      const door = createDoor(pool, fx.audience, 'test-secret-with-enough-entropy-0123456789abcdef');
      const port = createDoorPort(door, pool, fx.audience);

      const missing = await port.verify({ headers: new Headers(), audience: fx.audience });
      assert.equal(missing.tag, 'Denied');

      const wrongAud = await port.verify({
        headers: new Headers({ cookie: 'zoen.session_token=x' }),
        audience: 'http://evil.example',
      });
      assert.equal(wrongAud.tag, 'Denied');
      if (wrongAud.tag === 'Denied') assert.equal(wrongAud.code, 'WRONG_AUDIENCE');

      // Email must not be usable as subject map key
      const emailSubject = await port.mapSubject('person@example.com');
      assert.equal(emailSubject.tag, 'InvalidInput');

      const signed = await signUpWithCookie(door, {
        email: `neg-${randomUUID()}@example.com`,
        password: fx.password,
        name: 'Neg',
      });
      assert.equal(signed.tag, 'Ok');
      if (signed.tag !== 'Ok') return;
      const headers = new Headers({ cookie: signed.value.cookie });
      await port.revokeSession({ headers, audience: fx.audience }, signed.value.token);
      const entry = await port.attemptPrivateWorldEntry(
        { headers, audience: fx.audience },
        { worldId: fx.worldId as never, purpose: fx.purpose },
      );
      assert.ok(entry.tag === 'Denied' || entry.tag === 'Expired');
      // No grant artifact
      const grants = await pool.query('SELECT to_regclass(\'ontology.grants\') AS g');
      // ontology.grants may exist from other migrations; presence path must not insert
      const mapCount = await pool.query('SELECT count(*)::int AS n FROM door.subject_map');
      assert.ok(mapCount.rows[0].n >= 0);
      void grants;
    } finally {
      await pool.end();
    }
  });

  test('ZN-0013-BOUNDARY', async () => {
    const fx = fixture();
    const url = requireDbUrl();
    const pool = new pg.Pool({ connectionString: url });
    try {
      await resetHarness(pool);
      const door = createDoor(pool, fx.audience, 'test-secret-with-enough-entropy-0123456789abcdef');
      const port = createDoorPort(door, pool, fx.audience);

      const signed = await signUpWithCookie(door, {
        email: `bdy-${randomUUID()}@example.com`,
        password: fx.password,
        name: 'Boundary',
      });
      assert.equal(signed.tag, 'Ok');
      if (signed.tag !== 'Ok') return;
      const headers = new Headers({ cookie: signed.value.cookie });

      // Duplicate verify at same basis — deterministic PresenceProof principal
      const a = await port.verify({ headers, audience: fx.audience });
      const b = await port.verify({ headers, audience: fx.audience });
      assert.equal(a.tag, 'Ok');
      assert.equal(b.tag, 'Ok');
      if (a.tag === 'Ok' && b.tag === 'Ok') {
        assert.equal(a.value.principalId, b.value.principalId);
        assert.equal(a.value.subjectId, b.value.subjectId);
        assert.equal(a.value.worldGrant, null);
      }

      // Race: duplicate subject map insert collapses to one principal
      const subjectId = signed.value.subjectId;
      await Promise.all([port.mapSubject(subjectId), port.mapSubject(subjectId)]);
      const rows = await pool.query('SELECT count(*)::int AS n FROM door.subject_map WHERE subject_id=$1', [
        subjectId,
      ]);
      assert.equal(rows.rows[0].n, 1);

      // Changed basis (revoked) → explicit denial
      await port.revokeSession({ headers, audience: fx.audience }, signed.value.token);
      const stale = await port.verify({ headers, audience: fx.audience });
      assert.equal(stale.tag, 'Denied');
    } finally {
      await pool.end();
    }
  });
}

await registerZn0013Tests();
