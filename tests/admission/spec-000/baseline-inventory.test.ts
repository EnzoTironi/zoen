import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const ADMISSION_PATH = join(
  WORKSPACE_ROOT,
  'admissions/spec-000/baseline-inventory.json',
);
const SCHEMA_PATH = join(
  WORKSPACE_ROOT,
  'contracts/spec-000/baseline-inventory.schema.json',
);
const FIXTURE_PATH = join(
  WORKSPACE_ROOT,
  'tests/fixtures/spec-000/baseline-inventory.json',
);
const V2_ZIP_PATH = join(WORKSPACE_ROOT, 'archives/zoen-execution-v4.zip');
const LEDGER_SHA256 =
  'a373b45fc488df178707d0e25b5685b1071039172fc357c3bda16af347a4fbd8';
const FIXTURE_SEED = 'zn-0001-admission-seed-v1';

const OS_REPO = {
  id: 'os-migration-source',
  url: 'https://github.com/EnzoTironi/OS.git',
  rawBase: 'https://raw.githubusercontent.com/EnzoTironi/OS',
  role: 'read-only-migration-source' as const,
  ref: 'refs/heads/main',
};

const ZOEN_REPO = {
  id: 'zoen-implementation-target',
  url: 'https://github.com/EnzoTironi/zoen.git',
  rawBase: 'https://raw.githubusercontent.com/EnzoTironi/zoen',
  role: 'implementation-target' as const,
  ref: 'refs/heads/main',
};

type Classification = 'import' | 'rewrite' | 'discard';

type AdmitResult =
  | { ok: true; inventory: Record<string, unknown> }
  | {
      ok: false;
      blocked: true;
      missingRequirements: string[];
      disabledRoute: string;
      newlyBlockedScope?: string;
    };

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function sha256File(path: string): string {
  return sha256Buffer(readFileSync(path));
}

function lsRemoteHead(repoUrl: string, ref: string): string {
  const out = execFileSync(
    'git',
    ['ls-remote', repoUrl, ref],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'credential.helper',
        GIT_CONFIG_VALUE_0: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();
  const line = out.split('\n').find((l) => l.includes(ref));
  if (!line) throw new Error(`ls-remote miss for ${repoUrl} ${ref}`);
  const sha = line.split(/[\s\t]/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`bad sha from ls-remote: ${sha}`);
  return sha;
}

function fetchRaw(url: string): { ok: true; text: string } | { ok: false; status: number } {
  const out = execFileSync(
    'curl',
    ['-fsSL', '-w', '\n%{http_code}', url],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CURL_HOME: '/nonexistent' },
    },
  );
  // curl -f fails on HTTP errors; success path ends with code
  const lines = out.replace(/\n$/, '').split('\n');
  const status = Number(lines.pop());
  const text = lines.join('\n');
  if (!Number.isFinite(status) || status >= 400) return { ok: false, status: status || 0 };
  return { ok: true, text };
}

function fetchRawAllow404(url: string): string | null {
  try {
    const res = fetchRaw(url);
    return res.ok ? res.text : null;
  } catch {
    // curl -f exits non-zero on 404
    return null;
  }
}

function parsePackageName(packageJsonText: string): Record<string, unknown> {
  const pkg = JSON.parse(packageJsonText) as Record<string, unknown>;
  return {
    name: pkg.name ?? null,
    private: pkg.private ?? null,
    packageManager: pkg.packageManager ?? null,
    engines: pkg.engines ?? null,
  };
}

function parseCargoLicense(cargoToml: string): string | null {
  const m = cargoToml.match(/^\s*license\s*=\s*"([^"]+)"/m);
  return m?.[1] ?? null;
}

function detectSpdxFromLicenseFile(text: string): string | null {
  if (/^MIT License/m.test(text)) return 'MIT';
  if (/Apache License/i.test(text)) return 'Apache-2.0';
  return null;
}

function componentCatalog(): Array<{
  id: string;
  sourceRepository: string;
  path: string;
  classification: Classification;
  evidence: 'present' | 'absent';
  rationale: string;
}> {
  // Default to rewrite when reuse evidence (journey/tests proving portability) is absent.
  // Historical guidance: do not automatically port Rust kernel, DB schema, or old Eve topology.
  return [
    {
      id: 'os-crates-zoen-core',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-core',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Rust kernel must not be automatically ported into zoen TypeScript ownership.',
    },
    {
      id: 'os-crates-zoen-engine',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-engine',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Old execution engine topology is not an admitted zoen import.',
    },
    {
      id: 'os-crates-zoen-adapters',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-adapters',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Adapter surface is a reuse candidate, but no verified journey evidence; default rewrite.',
    },
    {
      id: 'os-crates-zoen-proto',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-proto',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Wire shapes may inform contracts; no evidence for direct import; default rewrite.',
    },
    {
      id: 'os-crates-zoen-query',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-query',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Query stack bound to OS topology; not an automatic import.',
    },
    {
      id: 'os-apps-zoend',
      sourceRepository: OS_REPO.id,
      path: 'apps/zoend',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'OS daemon entrypoint is not the zoen semantic edge; discard for reuse.',
    },
    {
      id: 'os-proto',
      sourceRepository: OS_REPO.id,
      path: 'proto',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Protobuf definitions may inform migration; no import evidence; default rewrite.',
    },
    {
      id: 'os-deploy',
      sourceRepository: OS_REPO.id,
      path: 'deploy',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'OS deployment must never be reset by this admission; not imported.',
    },
    {
      id: 'os-authentication-adapters',
      sourceRepository: OS_REPO.id,
      path: 'apps/authentication-adapters',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Authentication adapters are reuse candidates; evidence absent → rewrite.',
    },
    {
      id: 'os-provider-wiring',
      sourceRepository: OS_REPO.id,
      path: 'provider-wiring',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Provider wiring is a reuse candidate; evidence absent → rewrite.',
    },
    {
      id: 'os-ui-components',
      sourceRepository: OS_REPO.id,
      path: 'ui-components',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'UI components are reuse candidates; evidence absent → rewrite.',
    },
    {
      id: 'os-domain-vocabulary',
      sourceRepository: OS_REPO.id,
      path: 'domain-vocabulary',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Domain vocabulary is a reuse candidate; evidence absent → rewrite.',
    },
    {
      id: 'os-database-schema',
      sourceRepository: OS_REPO.id,
      path: 'database-schema',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Do not automatically port OS database schema into zoen authority migrations.',
    },
    {
      id: 'os-eve-execution-topology',
      sourceRepository: OS_REPO.id,
      path: 'eve-execution-topology',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Old Eve execution topology is explicitly not auto-ported.',
    },
    {
      id: 'v2-hashed-package-docs',
      sourceRepository: 'hashed-v2-package',
      path: 'archives/zoen-execution-v4.zip',
      classification: 'import',
      evidence: 'present',
      rationale: 'Hashed v2 package is the preserved architecture archive; import as immutable historical input only.',
    },
  ];
}

function requireCommitPin(value: unknown, label: string, missing: string[]): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    missing.push(`${label} must be a 40-char lowercase commit sha`);
  }
}

/** Structural admission check aligned to contracts/spec-000/baseline-inventory.schema.json */
export function admitBaselineInventory(
  candidate: unknown,
  options?: { expectedPins?: { os?: string; zoen?: string; v2Sha256?: string } },
): AdmitResult {
  const missingRequirements: string[] = [];
  const disabledRoute = 'destructive-migration-and-os-reset';

  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      ok: false,
      blocked: true,
      missingRequirements: ['qualification artifact must be a JSON object'],
      disabledRoute,
    };
  }

  const inv = candidate as Record<string, unknown>;
  if (inv.schemaVersion !== 'spec-000.baseline-inventory.v1') {
    missingRequirements.push('schemaVersion=spec-000.baseline-inventory.v1');
  }
  if (inv.ticket !== 'ZN-0001') missingRequirements.push('ticket=ZN-0001');
  if (inv.spec !== 'SPEC-000') missingRequirements.push('spec=SPEC-000');
  if (inv.writeCredentialsUsed !== false) {
    missingRequirements.push('writeCredentialsUsed must be false');
  }

  if (!Array.isArray(inv.repositories) || inv.repositories.length < 2) {
    missingRequirements.push('repositories must include both public repos');
  } else {
    for (const [i, repo] of inv.repositories.entries()) {
      if (!repo || typeof repo !== 'object') {
        missingRequirements.push(`repositories[${i}] invalid`);
        continue;
      }
      const r = repo as Record<string, unknown>;
      requireCommitPin(r.commit, `repositories[${i}].commit`, missingRequirements);
      const uv = r.unchangedVerification as Record<string, unknown> | undefined;
      if (!uv || uv.matched !== true) {
        missingRequirements.push(`repositories[${i}].unchangedVerification.matched`);
      }
      if (!uv || uv.preCommit !== uv.postCommit) {
        missingRequirements.push(`repositories[${i}] pre/post commit mismatch marks repos changed`);
      }
      if (!r.license || typeof r.license !== 'object') {
        missingRequirements.push(`repositories[${i}].license`);
      }
      if (!r.rootManifests || typeof r.rootManifests !== 'object') {
        missingRequirements.push(`repositories[${i}].rootManifests`);
      }
    }
  }

  if (!Array.isArray(inv.hashedPackages) || inv.hashedPackages.length < 1) {
    missingRequirements.push('hashedPackages must include the v2 package');
  } else {
    const pkg = inv.hashedPackages[0] as Record<string, unknown>;
    if (typeof pkg.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(pkg.sha256)) {
      missingRequirements.push('hashedPackages[0].sha256');
    }
  }

  if (!Array.isArray(inv.components) || inv.components.length < 1) {
    missingRequirements.push('components classification list');
  } else {
    for (const [i, c] of inv.components.entries()) {
      const row = c as Record<string, unknown>;
      if (!['import', 'rewrite', 'discard'].includes(String(row.classification))) {
        missingRequirements.push(`components[${i}].classification`);
      }
      if (row.evidence === 'absent' && row.classification === 'import') {
        missingRequirements.push(
          `components[${i}] cannot be import when evidence is absent (default rewrite)`,
        );
      }
    }
  }

  const live = inv.liveDataPreservation as Record<string, unknown> | undefined;
  if (!live || typeof live !== 'object') {
    missingRequirements.push('liveDataPreservation must be present (unresolved, not empty)');
  } else {
    if (live.status !== 'unresolved') {
      missingRequirements.push('liveDataPreservation.status must be unresolved');
    }
    if (live.inventory !== 'unknown') {
      missingRequirements.push('liveDataPreservation.inventory must be unknown');
    }
    if (live.tenantsVerified !== false) {
      missingRequirements.push('liveDataPreservation.tenantsVerified must be false');
    }
    if (live.osDeploymentResetForbidden !== true) {
      missingRequirements.push('osDeploymentResetForbidden must be true');
    }
    // Explicitly reject "empty" representations
    if (Array.isArray(live) || live.status === 'empty' || live.inventory === '') {
      missingRequirements.push('liveDataPreservation must not be empty');
    }
  }

  if (options?.expectedPins?.os || options?.expectedPins?.zoen) {
    const repos = Array.isArray(inv.repositories) ? inv.repositories : [];
    for (const repo of repos) {
      const r = repo as Record<string, unknown>;
      if (r.id === OS_REPO.id && options.expectedPins.os && r.commit !== options.expectedPins.os) {
        missingRequirements.push(
          `OS commit pin drift: artifact=${r.commit} selection=${options.expectedPins.os}`,
        );
      }
      if (
        r.id === ZOEN_REPO.id &&
        options.expectedPins.zoen &&
        r.commit !== options.expectedPins.zoen
      ) {
        missingRequirements.push(
          `zoen commit pin drift: artifact=${r.commit} selection=${options.expectedPins.zoen}`,
        );
      }
    }
  }
  if (options?.expectedPins?.v2Sha256) {
    const pkgs = Array.isArray(inv.hashedPackages) ? inv.hashedPackages : [];
    const sha = (pkgs[0] as Record<string, unknown> | undefined)?.sha256;
    if (sha !== options.expectedPins.v2Sha256) {
      missingRequirements.push(
        `v2 package digest drift: artifact=${sha} selection=${options.expectedPins.v2Sha256}`,
      );
    }
  }

  if (missingRequirements.length > 0) {
    return {
      ok: false,
      blocked: true,
      missingRequirements,
      disabledRoute,
      newlyBlockedScope: missingRequirements.join('; '),
    };
  }

  return { ok: true, inventory: inv };
}

/** Read-only inventory command: no write credentials; does not mutate remote repos. */
export function runBaselineInventory(): Record<string, unknown> {
  const commands: string[] = [];

  const osPre = lsRemoteHead(OS_REPO.url, OS_REPO.ref);
  commands.push(`git ls-remote ${OS_REPO.url} ${OS_REPO.ref} -> ${osPre}`);
  const zoenPre = lsRemoteHead(ZOEN_REPO.url, ZOEN_REPO.ref);
  commands.push(`git ls-remote ${ZOEN_REPO.url} ${ZOEN_REPO.ref} -> ${zoenPre}`);

  const osLicenseText = fetchRawAllow404(`${OS_REPO.rawBase}/${osPre}/LICENSE`);
  commands.push(`curl raw OS LICENSE @ ${osPre}`);
  const osPackageText = fetchRawAllow404(`${OS_REPO.rawBase}/${osPre}/package.json`);
  commands.push(`curl raw OS package.json @ ${osPre}`);
  const osCargoText = fetchRawAllow404(`${OS_REPO.rawBase}/${osPre}/Cargo.toml`);
  commands.push(`curl raw OS Cargo.toml @ ${osPre}`);

  const zoenLicenseText = fetchRawAllow404(`${ZOEN_REPO.rawBase}/${zoenPre}/LICENSE`);
  commands.push(`curl raw zoen LICENSE @ ${zoenPre}`);
  const zoenPackageText = fetchRawAllow404(`${ZOEN_REPO.rawBase}/${zoenPre}/package.json`);
  commands.push(`curl raw zoen package.json @ ${zoenPre}`);

  if (!osPackageText) throw new Error('OS package.json unavailable at pinned head');
  if (!zoenPackageText) throw new Error('zoen package.json unavailable at pinned head');
  if (!existsSync(V2_ZIP_PATH)) throw new Error(`missing hashed v2 package at ${V2_ZIP_PATH}`);

  const v2Sha = sha256File(V2_ZIP_PATH);
  const v2Bytes = statSync(V2_ZIP_PATH).size;
  commands.push(`sha256sum archives/zoen-execution-v4.zip -> ${v2Sha}`);

  const osSpdx = osLicenseText ? detectSpdxFromLicenseFile(osLicenseText) : null;
  const osCargoLicense = osCargoText ? parseCargoLicense(osCargoText) : null;
  const osLicenseStatus =
    !osLicenseText
      ? 'absent'
      : osCargoLicense && osSpdx && osCargoLicense !== osSpdx
        ? 'observed-with-conflict'
        : 'observed';

  const osPost = lsRemoteHead(OS_REPO.url, OS_REPO.ref);
  const zoenPost = lsRemoteHead(ZOEN_REPO.url, ZOEN_REPO.ref);
  commands.push(`git ls-remote (post) OS -> ${osPost}`);
  commands.push(`git ls-remote (post) zoen -> ${zoenPost}`);

  const inventory = {
    schemaVersion: 'spec-000.baseline-inventory.v1',
    ticket: 'ZN-0001',
    spec: 'SPEC-000',
    writeCredentialsUsed: false,
    producedAt: new Date().toISOString(),
    repositories: [
      {
        id: OS_REPO.id,
        url: 'https://github.com/EnzoTironi/OS',
        role: OS_REPO.role,
        ref: OS_REPO.ref,
        commit: osPre,
        license: {
          status: osLicenseStatus,
          file: osLicenseText ? 'LICENSE' : null,
          spdxObserved: osSpdx,
          cargoTomlLicense: osCargoLicense,
          sha256: osLicenseText ? sha256Buffer(Buffer.from(osLicenseText)) : null,
          notes:
            osLicenseStatus === 'observed-with-conflict'
              ? 'LICENSE file SPDX differs from Cargo.toml workspace.package.license; both recorded.'
              : 'Observed from public raw content at pinned commit.',
        },
        rootManifests: {
          'package.json': parsePackageName(osPackageText),
          ...(osCargoText
            ? {
                'Cargo.toml': {
                  'workspace.package.license': osCargoLicense,
                  homepage: 'https://github.com/EnzoTironi/OS',
                },
              }
            : {}),
        },
        unchangedVerification: {
          method: 'git-ls-remote',
          preCommit: osPre,
          postCommit: osPost,
          matched: osPre === osPost,
        },
      },
      {
        id: ZOEN_REPO.id,
        url: 'https://github.com/EnzoTironi/zoen',
        role: ZOEN_REPO.role,
        ref: ZOEN_REPO.ref,
        commit: zoenPre,
        license: {
          status: zoenLicenseText ? 'observed' : 'absent',
          file: zoenLicenseText ? 'LICENSE' : null,
          spdxObserved: zoenLicenseText ? detectSpdxFromLicenseFile(zoenLicenseText) : null,
          cargoTomlLicense: null,
          sha256: zoenLicenseText ? sha256Buffer(Buffer.from(zoenLicenseText)) : null,
          notes: zoenLicenseText
            ? 'Observed from public raw content at pinned commit.'
            : 'No LICENSE file at repository head; recorded as absent, not invented.',
        },
        rootManifests: {
          'package.json': parsePackageName(zoenPackageText),
        },
        unchangedVerification: {
          method: 'git-ls-remote',
          preCommit: zoenPre,
          postCommit: zoenPost,
          matched: zoenPre === zoenPost,
        },
      },
    ],
    hashedPackages: [
      {
        id: 'zoen-execution-v4',
        path: 'archives/zoen-execution-v4.zip',
        label: 'hashed-v2-package',
        sha256: v2Sha,
        bytes: v2Bytes,
        sourceLedger: 'docs/lineage/source-ledger.md',
        expectedSha256FromLedger: LEDGER_SHA256,
      },
    ],
    components: componentCatalog(),
    liveDataPreservation: {
      status: 'unresolved',
      inventory: 'unknown',
      tenantsVerified: false,
      ownerSupplyRequired: true,
      osDeploymentResetForbidden: true,
      notes:
        'No verified inventory of live tenants was supplied. Production-data inventory remains unknown/unresolved until the owner provides it. OS deployment must not be reset.',
    },
    observations: {
      commands,
      profile: 'admission-read-only',
      fixtureSeed: FIXTURE_SEED,
    },
  };

  if (v2Sha !== LEDGER_SHA256) {
    throw new Error(`v2 package digest mismatch: observed=${v2Sha} ledger=${LEDGER_SHA256}`);
  }

  const admitted = admitBaselineInventory(inventory);
  if (!admitted.ok) {
    throw new Error(`inventory failed admission: ${admitted.missingRequirements.join('; ')}`);
  }

  return inventory;
}


function registerZn0001Tests(): void {
  test('ZN-0001-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true, 'schema must exist for admission boundary');

    const inventory = runBaselineInventory();
    const admitted = admitBaselineInventory(inventory);
    assert.equal(admitted.ok, true);
    assert.equal(inventory.writeCredentialsUsed, false);

    const repos = inventory.repositories as Array<Record<string, unknown>>;
    assert.equal(repos.length, 2);
    for (const repo of repos) {
      assert.match(String(repo.commit), /^[0-9a-f]{40}$/);
      const uv = repo.unchangedVerification as Record<string, unknown>;
      assert.equal(uv.matched, true);
      assert.equal(uv.preCommit, uv.postCommit);
    }

    const live = inventory.liveDataPreservation as Record<string, unknown>;
    assert.equal(live.status, 'unresolved');
    assert.equal(live.inventory, 'unknown');
    assert.notEqual(live.status, 'empty');
    assert.ok(live && typeof live === 'object');

    const pkgs = inventory.hashedPackages as Array<Record<string, unknown>>;
    assert.equal(pkgs[0]?.sha256, LEDGER_SHA256);

    assert.equal(existsSync(ADMISSION_PATH), true, 'commit-pinned admission artifact must be recorded');
    const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8')) as Record<string, unknown>;
    const recordedAdmit = admitBaselineInventory(recorded);
    assert.equal(recordedAdmit.ok, true);
    const recordedLive = recorded.liveDataPreservation as Record<string, unknown>;
    assert.equal(recordedLive.status, 'unresolved');
    assert.equal(recorded.writeCredentialsUsed, false);

    // Fresh command pins must match recorded pins for the same heads (no silent rewrite of history).
    const recRepos = recorded.repositories as Array<Record<string, unknown>>;
    for (const fresh of repos) {
      const prior = recRepos.find((r) => r.id === fresh.id);
      assert.ok(prior, `recorded repo ${fresh.id}`);
      assert.equal(prior?.commit, fresh.commit);
    }
  });

  test('ZN-0001-NEG', async () => {
    assert.equal(existsSync(FIXTURE_PATH), true);
    const incomplete = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
    const result = admitBaselineInventory(incomplete);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.blocked, true);
    assert.ok(result.missingRequirements.length > 0);
    assert.equal(result.disabledRoute, 'destructive-migration-and-os-reset');
    assert.match(result.missingRequirements.join(' '), /liveDataPreservation|repositories|schemaVersion/);

    // Incomplete artifact must not be treated as the admitted baseline file.
    if (existsSync(ADMISSION_PATH)) {
      const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8'));
      assert.notDeepEqual(recorded, incomplete);
      assert.equal(admitBaselineInventory(recorded).ok, true);
    }
  });

  test('ZN-0001-BOUNDARY', async () => {
    assert.equal(existsSync(ADMISSION_PATH), true);
    const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8')) as Record<string, unknown>;
    assert.equal(admitBaselineInventory(recorded).ok, true);

    const changedVersion = structuredClone(recorded) as Record<string, unknown>;
    const repos = changedVersion.repositories as Array<Record<string, unknown>>;
    const os = repos.find((r) => r.id === OS_REPO.id);
    assert.ok(os);
    const previousCommit = String(os!.commit);
    const forged =
      previousCommit.replace(/[0-9a-f]$/, (c) => (c === '0' ? '1' : '0'));
    os!.commit = forged;
    (os!.unchangedVerification as Record<string, unknown>).preCommit = forged;
    (os!.unchangedVerification as Record<string, unknown>).postCommit = forged;

    const replay = admitBaselineInventory(changedVersion, {
      expectedPins: {
        os: previousCommit,
        zoen: String(repos.find((r) => r.id === ZOEN_REPO.id)?.commit),
        v2Sha256: LEDGER_SHA256,
      },
    });
    assert.equal(replay.ok, false);
    if (replay.ok) return;
    assert.equal(replay.blocked, true);
    assert.ok(
      replay.missingRequirements.some((m) => m.includes('OS commit pin drift')),
      replay.missingRequirements.join('; '),
    );
    assert.equal(replay.newlyBlockedScope?.includes('OS commit pin drift'), true);

    // Expired/mismatched package digest also cannot reuse prior evidence.
    const changedDigest = structuredClone(recorded) as Record<string, unknown>;
    (changedDigest.hashedPackages as Array<Record<string, unknown>>)[0]!.sha256 =
      '0'.repeat(64);
    const digestReplay = admitBaselineInventory(changedDigest, {
      expectedPins: { v2Sha256: LEDGER_SHA256 },
    });
    assert.equal(digestReplay.ok, false);
    if (digestReplay.ok) return;
    assert.ok(digestReplay.missingRequirements.some((m) => m.includes('v2 package digest drift')));
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0001_RUN_TESTS === '1') {
  registerZn0001Tests();
}

