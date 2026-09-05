import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  DISABLED_ROUTE,
  evaluateLicensePolicy,
  evaluatePromotion,
  generateSbom,
  resolveSigningIdentity,
  scanForSecrets,
} from '../../../tooling/supply-chain.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function registerZn0006Tests(): void {
  test('ZN-0006-AC', () => {
    assert.equal(existsSync(join(ROOT, 'contracts/spec-000/supply-chain.schema.json')), true);
    assert.equal(existsSync(join(ROOT, '.github/workflows/release.yml')), true);
    assert.equal(existsSync(join(ROOT, 'CODEOWNERS')), true);

    const sbom = generateSbom(ROOT);
    assert.ok(sbom.digest);
    assert.ok(sbom.packages.length > 0);

    // Dependency changed without lock update
    const deniedLock = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: { hono: '0.0.0-not-locked' },
      expectedLockDigest: sbom.lockDigest,
    });
    assert.equal(deniedLock.ok, false);
    if (deniedLock.ok) return;
    assert.equal(deniedLock.denied, true);
    assert.equal(deniedLock.code, 'dependency-changed-without-lock-update');
    assert.match(deniedLock.mismatch, /hono/);
    assert.equal(deniedLock.disabledRoute, DISABLED_ROUTE);
    assert.equal(deniedLock.redacted, true);
    assert.ok(!deniedLock.evidence.join(' ').includes('password'));

    // Unsigned image offered for promotion
    const deniedUnsigned = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: {},
      expectedLockDigest: sbom.lockDigest,
      image: {
        reference: 'zoen/edge',
        digest: 'sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280',
      },
      signingEnv: { ZOEN_ADMITTED_SIGNING_IDENTITY: 'projects/zoen/signing/admission-ref' },
    });
    assert.equal(deniedUnsigned.ok, false);
    if (deniedUnsigned.ok) return;
    assert.equal(deniedUnsigned.code, 'unsigned-image');
    assert.ok(deniedUnsigned.evidence.some((e) => e.includes('signature-absent')));
    // Must not print credential material
    assert.ok(!deniedUnsigned.evidence.join('\n').includes('BEGIN'));
  });

  test('ZN-0006-NEG', () => {
    assert.equal(existsSync(join(ROOT, 'tests/fixtures/spec-000/supply-chain.json')), true);
    const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/spec-000/supply-chain.json'), 'utf8')) as {
      note?: string;
    };
    assert.ok(fixture.note?.includes('Synthetic'));

    const missingSign = resolveSigningIdentity({});
    assert.equal(missingSign.status, 'MissingPrerequisite');
    assert.ok(missingSign.missing?.includes('ZOEN_ADMITTED_SIGNING_IDENTITY'));

    const denied = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: {},
      image: {
        reference: 'zoen/edge',
        digest: 'sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280',
      },
      signingEnv: {},
    });
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, 'signing-identity-missing');

    // Secret scanning finds patterns without echoing secrets in full
    const scan = scanForSecrets('password=supersecretvalue123\nsafe=1');
    assert.ok(scan.findings.includes('password-assignment'));
    assert.ok(scan.redactedPreview.includes('<redacted>'));
    assert.ok(!scan.redactedPreview.includes('supersecretvalue123'));
  });

  test('ZN-0006-BOUNDARY', () => {
    const sbom = generateSbom(ROOT);
    const a = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: {},
      expectedLockDigest: sbom.lockDigest,
      image: {
        reference: 'zoen/edge',
        digest: 'sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280',
        signatureRef: 'sigstore:rekor/entry/1',
      },
      signingEnv: { ZOEN_ADMITTED_SIGNING_IDENTITY: 'projects/zoen/signing/admission-ref' },
    });
    const b = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: {},
      expectedLockDigest: sbom.lockDigest,
      image: {
        reference: 'zoen/edge',
        digest: 'sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280',
        signatureRef: 'sigstore:rekor/entry/1',
      },
      signingEnv: { ZOEN_ADMITTED_SIGNING_IDENTITY: 'projects/zoen/signing/admission-ref' },
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.sbomDigest, b.sbomDigest);

    // Revoked signing / profile limit
    const revoked = evaluatePromotion({
      root: ROOT,
      sourceCommit: 'abc123abc123abc123abc123abc123abc123abc1',
      declaredDependencies: {},
      expectedLockDigest: sbom.lockDigest,
      image: {
        reference: 'zoen/edge',
        digest: 'sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280',
        signatureRef: 'sig',
      },
      signingEnv: { ZOEN_ADMITTED_SIGNING_IDENTITY: '-----BEGIN PRIVATE KEY-----\nMII\n' },
    });
    assert.equal(revoked.ok, false);

    // Duplicate/reordered license evaluation is stable
    const pkgs = [
      { name: 'a', version: '1', license: 'MIT' },
      { name: 'b', version: '1', license: 'GPL-3.0' },
    ];
    const l1 = evaluateLicensePolicy(pkgs);
    const l2 = evaluateLicensePolicy([...pkgs].reverse());
    assert.equal(l1.ok, false);
    assert.equal(l2.ok, false);
    assert.equal(l1.violations.length, l2.violations.length);

    // CLI deny path
    const cli = spawnSync(process.execPath, ['--experimental-strip-types', join(ROOT, 'tooling/supply-chain.ts')], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.notEqual(cli.status, 0);
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0006_RUN_TESTS === '1') {
  registerZn0006Tests();
}
