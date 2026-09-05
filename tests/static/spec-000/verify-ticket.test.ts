import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  DISABLED_ROUTE,
  FIXTURE_SEED,
  evidenceDigest,
  getTicket,
  gitHead,
  lockDigest,
  verifyTicket,
  type CheckEvidence,
} from '../../../tooling/verify-ticket.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const SCHEMA = join(ROOT, 'contracts/spec-000/verify-ticket.schema.json');
const FIXTURE = join(ROOT, 'tests/fixtures/spec-000/verify-ticket.json');

function passedChecks(ticketId: string, commit: string, digest: string): CheckEvidence[] {
  const ticket = getTicket(ticketId, ROOT);
  return ticket.checks.map((c) => ({
    id: c.id,
    layer: c.layer,
    status: 'passed' as const,
    executedCount: 1,
    skippedCount: 0,
    sourceCommit: commit,
    lockDigest: digest,
    observations: [`oracle:${c.oracle.slice(0, 80)}`],
  }));
}

function registerZn0005Tests(): void {
  test('ZN-0005-AC', () => {
    assert.equal(existsSync(SCHEMA), true);
    assert.equal(existsSync(join(ROOT, '.github/workflows/verify.yml')), true);
    const commit = gitHead(ROOT);
    const digest = lockDigest(ROOT);
    const ticketId = 'ZN-0005';
    const all = passedChecks(ticketId, commit, digest);
    assert.equal(all.length, 3);

    // Only two of three execute => reject with missing check ID
    const two = all.slice(0, 2);
    const rejected = verifyTicket({
      ticketId,
      profile: 'admitted-static-profile',
      sourceCommit: commit,
      lockDigest: digest,
      observedChecks: two,
      author: 'agent',
      review: { reviewer: 'human-reviewer', decision: 'approved', sourceCommit: commit, lockDigest: digest },
      genericBuildGreen: true,
      fixtureSeed: FIXTURE_SEED,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.ok(rejected.missingCheckIds?.includes('ZN-0005-BOUNDARY'), rejected.reasons.join(';'));
    assert.ok(rejected.reasons.some((r) => r.includes('green generic build cannot replace')));
    assert.equal(rejected.disabledRoute, DISABLED_ROUTE);

    // Full three + independent review => passed evidence
    const ok = verifyTicket({
      ticketId,
      profile: 'admitted-static-profile',
      sourceCommit: commit,
      lockDigest: digest,
      observedChecks: all,
      author: 'agent',
      review: { reviewer: 'human-reviewer', decision: 'approved', sourceCommit: commit, lockDigest: digest },
      fixtureSeed: FIXTURE_SEED,
    });
    assert.equal(ok.ok, true, JSON.stringify(ok));
  });

  test('ZN-0005-NEG', () => {
    assert.equal(existsSync(FIXTURE), true);
    const incomplete = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outcome: string; note?: string };
    assert.ok(incomplete.note?.includes('Synthetic'));

    const commit = gitHead(ROOT);
    const digest = lockDigest(ROOT);
    const all = passedChecks('ZN-0005', commit, digest);

    // Skipped required check
    const skipped = all.map((c, i) =>
      i === 0 ? { ...c, status: 'skipped' as const, skippedCount: 1, executedCount: 0 } : c,
    );
    const skipResult = verifyTicket({
      ticketId: 'ZN-0005',
      profile: 'admitted-static-profile',
      sourceCommit: commit,
      lockDigest: digest,
      observedChecks: skipped,
      author: 'agent',
      review: { reviewer: 'rev', decision: 'approved', sourceCommit: commit, lockDigest: digest },
    });
    assert.equal(skipResult.ok, false);

    // Altered manifest / self-review
    const selfReview = verifyTicket({
      ticketId: 'ZN-0005',
      profile: 'admitted-static-profile',
      sourceCommit: commit,
      lockDigest: digest,
      observedChecks: all,
      author: 'same-person',
      review: { reviewer: 'same-person', decision: 'approved', sourceCommit: commit, lockDigest: digest },
    });
    assert.equal(selfReview.ok, false);
    if (selfReview.ok) return;
    assert.ok(selfReview.reasons.some((r) => r.includes('independent reviewer')));

    // CLI exits nonzero without evidence
    const cli = spawnSync(
      process.execPath,
      ['--experimental-strip-types', join(ROOT, 'tooling/verify-ticket.ts'), '--ticket', 'ZN-0005', '--profile', 'admitted-static-profile'],
      { encoding: 'utf8', cwd: ROOT },
    );
    assert.notEqual(cli.status, 0);
  });

  test('ZN-0005-BOUNDARY', () => {
    const commit = gitHead(ROOT);
    const digest = lockDigest(ROOT);
    const base = {
      ticketId: 'ZN-0003',
      profile: 'admitted-static-profile',
      sourceCommit: commit,
      lockDigest: digest,
      author: 'agent',
      review: {
        reviewer: 'human-reviewer',
        decision: 'approved' as const,
        sourceCommit: commit,
        lockDigest: digest,
      },
      fixtureSeed: FIXTURE_SEED,
    };

    const checks = passedChecks('ZN-0003', commit, digest);
    const a = verifyTicket({ ...base, observedChecks: checks });
    const b = verifyTicket({ ...base, observedChecks: [...checks].reverse() });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    // Equal semantic acceptance (both pass); digests of evidence bodies may differ by check order — compare sorted
    const norm = (e: typeof a.evidence) =>
      evidenceDigest({
        ...e,
        checks: [...e.checks].sort((x, y) => x.id.localeCompare(y.id)),
        commands: [...e.commands].sort(),
      });
    assert.equal(norm(a.evidence), norm(b.evidence));

    // Remove one required check
    const missing = verifyTicket({ ...base, observedChecks: checks.slice(0, 2) });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.ok((missing.missingCheckIds?.length ?? 0) >= 1);

    // Zero-test run
    const zero = verifyTicket({ ...base, observedChecks: [] });
    assert.equal(zero.ok, false);
    if (zero.ok) return;
    assert.ok(zero.reasons.some((r) => r.includes('zero-test')));
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0005_RUN_TESTS === '1') {
  registerZn0005Tests();
}
