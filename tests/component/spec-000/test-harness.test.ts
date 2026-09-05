import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISABLED_ROUTE,
  FIXTURE_SEED,
  NamedBarrier,
  REQUIRED_CHECK_IDS,
  TestClock,
  assertRequiredChecks,
  digestReport,
  resolveTestProfile,
  runHarness,
} from '../../../tooling/test-harness.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const SCHEMA = join(ROOT, 'contracts/spec-000/test-harness.schema.json');
const FIXTURE = join(ROOT, 'tests/fixtures/spec-000/test-harness.json');

function registerZn0004Tests(): void {
  test('ZN-0004-AC', async () => {
    assert.equal(existsSync(SCHEMA), true);
    assert.equal(existsSync(join(ROOT, 'vitest.config.ts')), true);
    assert.equal(existsSync(join(ROOT, 'playwright.config.ts')), true);
    assert.equal(existsSync(join(ROOT, 'compose.test.yaml')), true);
    assert.equal(existsSync(join(ROOT, 'execution-lock.json')), true);

    // Unconfigured real PostgreSQL profile => MissingPrerequisite (never skip)
    const unconfigured = resolveTestProfile('postgres-unconfigured');
    assert.equal(unconfigured.ok, false);
    if (unconfigured.ok) return;
    assert.equal(unconfigured.kind, 'MissingPrerequisite');
    assert.equal(unconfigured.skipped, false);
    assert.ok(unconfigured.missing.length > 0);
    assert.equal(unconfigured.disabledRoute, DISABLED_ROUTE);

    const unconfiguredRun = await runHarness({ profileName: 'postgres-unconfigured' });
    assert.equal(unconfiguredRun.ok, false);
    if (unconfiguredRun.ok) return;
    assert.equal(unconfiguredRun.skippedCount, 0);
    assert.equal(unconfiguredRun.executedCount, 0);
    assert.equal(unconfiguredRun.skipped, false);

    // Admitted tools profile runs nonzero tests and records seed/logs/versions
    const admitted = await runHarness({
      profileName: 'component-harness',
      seed: FIXTURE_SEED,
      selectors: [...REQUIRED_CHECK_IDS],
    });
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    if (!admitted.ok) return;
    assert.ok(admitted.executedCount > 0);
    assert.equal(admitted.skippedCount, 0);
    assert.equal(admitted.seed, FIXTURE_SEED);
    assert.ok(admitted.logs.length > 0);
    assert.ok(admitted.dependencyVersions.vitest);
    assert.ok(admitted.dependencyVersions['fast-check']);
    assert.ok(admitted.dependencyVersions.playwright);

    // verify:ticket-style profile resolution for postgres without URL fails closed
    const withPg = resolveTestProfile('component-harness-with-postgres', {});
    assert.equal(withPg.ok, false);
    if (withPg.ok) return;
    assert.equal(withPg.kind, 'MissingPrerequisite');
    assert.ok(withPg.missing.includes('ZOEN_TEST_DATABASE_URL'));
  });

  test('ZN-0004-NEG', async () => {
    assert.equal(existsSync(FIXTURE), true);
    const incomplete = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
      ok: boolean;
      executedCount: number;
      note?: string;
    };
    assert.equal(incomplete.ok, true);
    assert.equal(incomplete.executedCount, 0);
    assert.ok(incomplete.note?.includes('Synthetic'));

    // Remove a required tool from a temp package.json view via resolve against incomplete root
    const tmp = mkdtempSync(join(tmpdir(), 'zn-0004-neg-'));
    try {
      writeFileSync(
        join(tmp, 'package.json'),
        JSON.stringify({ name: 'neg', private: true, devDependencies: { vitest: '5.0.0' } }, null, 2),
      );
      // missing fast-check, playwright, configs
      const missingTool = resolveTestProfile('component-harness', process.env, tmp);
      assert.equal(missingTool.ok, false);
      if (missingTool.ok) return;
      assert.equal(missingTool.kind, 'MissingPrerequisite');
      assert.equal(missingTool.skipped, false);
      assert.ok(missingTool.missing.some((m) => m.includes('fast-check') || m.includes('playwright') || m.includes('vitest.config')));

      // Secret reference missing
      const missingSecret = resolveTestProfile('component-harness-full', {
        ZOEN_TEST_DATABASE_URL: 'postgresql://zoen_test:x@127.0.0.1:1/db',
      });
      assert.equal(missingSecret.ok, false);
      if (missingSecret.ok) return;
      assert.ok(missingSecret.missing.includes('ZOEN_TEST_S3_ENDPOINT'));
      assert.equal(missingSecret.skipped, false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('ZN-0004-BOUNDARY', async () => {
    // Duplicate / reordered selectors — same oracle
    const a = await runHarness({
      profileName: 'component-harness',
      seed: FIXTURE_SEED,
      selectors: ['ZN-0004-AC', 'ZN-0004-NEG', 'ZN-0004-BOUNDARY'],
    });
    const b = await runHarness({
      profileName: 'component-harness',
      seed: FIXTURE_SEED,
      selectors: ['ZN-0004-BOUNDARY', 'ZN-0004-AC', 'ZN-0004-NEG'],
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.executedCount, b.executedCount);
    assert.equal(a.seed, b.seed);
    assert.equal(a.dependencyVersions.vitest, b.dependencyVersions.vitest);

    // Revoked / unknown profile
    const revoked = resolveTestProfile('revoked-profile');
    assert.equal(revoked.ok, false);
    if (revoked.ok) return;
    assert.match(revoked.missing.join(','), /unknown-profile/);

    // Profile limit: full profile without storage reports incomplete, no fabricated success
    const limited = await runHarness({
      profileName: 'component-harness-full',
      env: { ZOEN_TEST_DATABASE_URL: 'postgresql://zoen_test:x@127.0.0.1:1/db' },
    });
    assert.equal(limited.ok, false);
    if (limited.ok) return;
    assert.equal(limited.kind, 'MissingPrerequisite');
    assert.equal(limited.skipped, false);

    // Clocks and barriers are test-only and deterministic
    const clock = new TestClock('2026-01-01T00:00:00.000Z');
    clock.advanceMs(5000);
    assert.equal(clock.now().toISOString(), '2026-01-01T00:00:05.000Z');
    const barrier = new NamedBarrier('boundary');
    assert.equal(barrier.isOpen(), false);
    const p = barrier.wait(1000);
    barrier.open();
    await p;
    assert.equal(barrier.isOpen(), true);

    // Required checks / zero-test
    assert.throws(() => assertRequiredChecks([]), /zero-test/);
    assert.throws(() => assertRequiredChecks(['ZN-0004-AC']), /missing/);
    assertRequiredChecks([...REQUIRED_CHECK_IDS]);

    // Digest stability for equal payloads
    const d1 = digestReport({ seed: FIXTURE_SEED, v: 1 });
    const d2 = digestReport({ v: 1, seed: FIXTURE_SEED });
    assert.equal(d1, d2);
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0004_RUN_TESTS === '1') {
  registerZn0004Tests();
}
