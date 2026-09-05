import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
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

function optionalRawResult(result: { status: number | null; stdout: string; stderr: string }): string | null {
  if (result.status !== 0) {
    throw new Error(`repository content unavailable: curl=${result.status}; ${result.stderr}`);
  }
  const split = result.stdout.lastIndexOf('\n');
  const status = Number(result.stdout.slice(split + 1));
  if (split >= 0 && status === 404) return null;
  if (split < 0 || status !== 200) {
    throw new Error(`repository content unavailable: curl=${result.status}, HTTP=${status}; ${result.stderr}`);
  }
  return result.stdout.slice(0, split);
}

function fetchRawAllow404(url: string): string | null {
  const result = spawnSync(
    'curl',
    ['-sSL', '--max-time', '30', '-w', '\n%{http_code}', url],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CURL_HOME: '/nonexistent' },
    },
  );
  return optionalRawResult(result);
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
  pathKind: 'repository-path' | 'conceptual-label' | 'archive-path';
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
      pathKind: 'repository-path',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Rust kernel must not be automatically ported into zoen TypeScript ownership.',
    },
    {
      id: 'os-crates-zoen-engine',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-engine',
      pathKind: 'repository-path',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Old execution engine topology is not an admitted zoen import.',
    },
    {
      id: 'os-crates-zoen-adapters',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-adapters',
      pathKind: 'repository-path',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Adapter surface is a reuse candidate, but no verified journey evidence; default rewrite.',
    },
    {
      id: 'os-crates-zoen-proto',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-proto',
      pathKind: 'repository-path',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Wire shapes may inform contracts; no evidence for direct import; default rewrite.',
    },
    {
      id: 'os-crates-zoen-query',
      sourceRepository: OS_REPO.id,
      path: 'crates/zoen-query',
      pathKind: 'repository-path',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Query stack bound to OS topology; not an automatic import.',
    },
    {
      id: 'os-apps-zoend',
      sourceRepository: OS_REPO.id,
      path: 'apps/zoend',
      pathKind: 'repository-path',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'OS daemon entrypoint is not the zoen semantic edge; discard for reuse.',
    },
    {
      id: 'os-proto',
      sourceRepository: OS_REPO.id,
      path: 'proto',
      pathKind: 'repository-path',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Protobuf definitions may inform migration; no import evidence; default rewrite.',
    },
    {
      id: 'os-deploy',
      sourceRepository: OS_REPO.id,
      path: 'deploy',
      pathKind: 'repository-path',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'OS deployment must never be reset by this admission; not imported.',
    },
    {
      id: 'os-authentication-adapters',
      sourceRepository: OS_REPO.id,
      path: 'apps/authentication-adapters',
      pathKind: 'conceptual-label',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Authentication adapters are reuse candidates; evidence absent → rewrite.',
    },
    {
      id: 'os-provider-wiring',
      sourceRepository: OS_REPO.id,
      path: 'provider-wiring',
      pathKind: 'conceptual-label',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Provider wiring is a reuse candidate; evidence absent → rewrite.',
    },
    {
      id: 'os-ui-components',
      sourceRepository: OS_REPO.id,
      path: 'ui-components',
      pathKind: 'conceptual-label',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'UI components are reuse candidates; evidence absent → rewrite.',
    },
    {
      id: 'os-domain-vocabulary',
      sourceRepository: OS_REPO.id,
      path: 'domain-vocabulary',
      pathKind: 'conceptual-label',
      classification: 'rewrite',
      evidence: 'absent',
      rationale: 'Domain vocabulary is a reuse candidate; evidence absent → rewrite.',
    },
    {
      id: 'os-database-schema',
      sourceRepository: OS_REPO.id,
      path: 'database-schema',
      pathKind: 'conceptual-label',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Do not automatically port OS database schema into zoen authority migrations.',
    },
    {
      id: 'os-eve-execution-topology',
      sourceRepository: OS_REPO.id,
      path: 'eve-execution-topology',
      pathKind: 'conceptual-label',
      classification: 'discard',
      evidence: 'absent',
      rationale: 'Old Eve execution topology is explicitly not auto-ported.',
    },
    {
      id: 'v2-hashed-package-docs',
      sourceRepository: 'hashed-v2-package',
      path: 'archives/zoen-execution-v4.zip',
      pathKind: 'archive-path',
      classification: 'import',
      evidence: 'present',
      rationale: 'Hashed v2 package is the preserved architecture archive; import as immutable historical input only.',
    },
  ];
}

function requireCommitPin(value: unknown, label: string, missing: string[]): void {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    missing.push(`${label} must be a 40-char lowercase commit sha`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
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

  if (!Array.isArray(inv.repositories) || inv.repositories.length !== 2) {
    missingRequirements.push('repositories must include each public repo exactly once');
  } else {
    for (const expected of [OS_REPO, ZOEN_REPO]) {
      const matches = inv.repositories.filter((repo) => isRecord(repo) && repo.id === expected.id);
      if (matches.length !== 1) {
        missingRequirements.push(`repositories must include ${expected.id} exactly once`);
      }
    }
    for (const [i, repo] of inv.repositories.entries()) {
      if (!isRecord(repo)) {
        missingRequirements.push(`repositories[${i}] invalid`);
        continue;
      }
      const r = repo;
      const expected = [OS_REPO, ZOEN_REPO].find((entry) => entry.id === r.id);
      if (!expected || r.url !== expected.url.replace(/\.git$/, '') || r.role !== expected.role || r.ref !== expected.ref) {
        missingRequirements.push(`repositories[${i}] identity/url/role/ref mismatch`);
      }
      requireCommitPin(r.commit, `repositories[${i}].commit`, missingRequirements);
      const uv = r.unchangedVerification;
      if (!isRecord(uv) || uv.method !== 'git-ls-remote' || uv.matched !== true) {
        missingRequirements.push(`repositories[${i}].unchangedVerification.matched`);
      }
      if (isRecord(uv)) {
        requireCommitPin(uv.preCommit, `repositories[${i}].unchangedVerification.preCommit`, missingRequirements);
        requireCommitPin(uv.postCommit, `repositories[${i}].unchangedVerification.postCommit`, missingRequirements);
      }
      if (!isRecord(uv) || uv.preCommit !== uv.postCommit) {
        missingRequirements.push(`repositories[${i}] pre/post commit mismatch marks repos changed`);
      }
      const license = r.license;
      if (!isRecord(license) || !['observed', 'observed-with-conflict', 'absent'].includes(String(license.status))) {
        missingRequirements.push(`repositories[${i}].license`);
      } else if (license.status === 'absent') {
        if (license.file !== null || license.sha256 !== null) {
          missingRequirements.push(`repositories[${i}].license absent must have null file/digest`);
        }
      } else if (license.file !== 'LICENSE' || typeof license.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(license.sha256)) {
        missingRequirements.push(`repositories[${i}].license observed requires file/digest`);
      }
      const manifests = r.rootManifests;
      const pkg = isRecord(manifests) ? manifests['package.json'] : undefined;
      if (!isRecord(pkg) || !isNonemptyString(pkg.name) ||
          !['private', 'packageManager', 'engines'].every((field) => Object.hasOwn(pkg, field))) {
        missingRequirements.push(`repositories[${i}].rootManifests`);
      }
    }
  }

  if (!Array.isArray(inv.hashedPackages) || inv.hashedPackages.length < 1) {
    missingRequirements.push('hashedPackages must include the v2 package');
  } else {
    const pkg = inv.hashedPackages[0];
    if (!isRecord(pkg) || pkg.id !== 'zoen-execution-v4' || pkg.path !== 'archives/zoen-execution-v4.zip' ||
        pkg.label !== 'hashed-v2-package' || pkg.sha256 !== LEDGER_SHA256 ||
        typeof pkg.bytes !== 'number' || !Number.isSafeInteger(pkg.bytes) || pkg.bytes < 1) {
      missingRequirements.push('hashedPackages[0].sha256');
    }
  }

  const expectedComponents = componentCatalog();
  if (!Array.isArray(inv.components) || inv.components.length !== expectedComponents.length) {
    missingRequirements.push('components classification list');
  } else {
    if (new Set(inv.components.filter(isRecord).map((row) => row.id)).size !== expectedComponents.length) {
      missingRequirements.push('components must contain each reviewed catalog identity exactly once');
    }
    for (const [i, c] of inv.components.entries()) {
      if (!isRecord(c)) {
        missingRequirements.push(`components[${i}] invalid`);
        continue;
      }
      const row = c;
      const known = expectedComponents.find((entry) => entry.id === row.id);
      if (!known || row.path !== known.path || row.pathKind !== known.pathKind || row.sourceRepository !== known.sourceRepository) {
        missingRequirements.push(`components[${i}] path identity/kind requires reviewed catalog selection`);
      }
      if (row.pathKind === 'conceptual-label' && (row.evidence !== 'absent' || row.classification === 'import')) {
        missingRequirements.push(`components[${i}] conceptual label is not observed import evidence`);
      }
      if (!['id', 'sourceRepository', 'path'].every((key) => isNonemptyString(row[key])) ||
          !['present', 'absent'].includes(String(row.evidence))) {
        missingRequirements.push(`components[${i}] identity/path/evidence`);
      }
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

  const live = inv.liveDataPreservation;
  if (!isRecord(live)) {
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
    if (live.ownerSupplyRequired !== true) {
      missingRequirements.push('liveDataPreservation.ownerSupplyRequired must be true');
    }
    if (live.osDeploymentResetForbidden !== true) {
      missingRequirements.push('osDeploymentResetForbidden must be true');
    }
    // Explicitly reject "empty" representations
    if (Array.isArray(live) || live.status === 'empty' || live.inventory === '') {
      missingRequirements.push('liveDataPreservation must not be empty');
    }
  }

  const observations = inv.observations;
  if (!isRecord(observations) || observations.profile !== 'admission-read-only' ||
      !isNonemptyString(observations.fixtureSeed) || !Array.isArray(observations.commands) ||
      observations.commands.length === 0 || !observations.commands.every(isNonemptyString)) {
    missingRequirements.push('observations must include commands, profile and fixtureSeed');
  }

  if (options?.expectedPins?.os || options?.expectedPins?.zoen) {
    const repos = Array.isArray(inv.repositories) ? inv.repositories : [];
    for (const repo of repos) {
      if (!isRecord(repo)) continue;
      const r = repo;
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
    const sha = isRecord(pkgs[0]) ? pkgs[0].sha256 : undefined;
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
export function runBaselineInventory(selectedPins?: { os: string; zoen: string }): Record<string, unknown> {
  const commands: string[] = [];

  if (selectedPins) {
    const missing: string[] = [];
    requireCommitPin(selectedPins.os, 'selected OS pin', missing);
    requireCommitPin(selectedPins.zoen, 'selected zoen pin', missing);
    if (missing.length) throw new Error(missing.join('; '));
  }
  const osHeadPre = lsRemoteHead(OS_REPO.url, OS_REPO.ref);
  commands.push(`git ls-remote ${OS_REPO.url} ${OS_REPO.ref} -> ${osHeadPre}`);
  const zoenHeadPre = lsRemoteHead(ZOEN_REPO.url, ZOEN_REPO.ref);
  commands.push(`git ls-remote ${ZOEN_REPO.url} ${ZOEN_REPO.ref} -> ${zoenHeadPre}`);
  const osPre = selectedPins?.os ?? osHeadPre;
  const zoenPre = selectedPins?.zoen ?? zoenHeadPre;
  commands.push(`read immutable repository snapshots: OS=${osPre}; zoen=${zoenPre}`);

  const treeText = fetchRawAllow404(`https://api.github.com/repos/EnzoTironi/OS/git/trees/${osPre}?recursive=1`);
  if (!treeText) throw new Error('OS repository tree unavailable at selected pin');
  const tree: unknown = JSON.parse(treeText);
  if (!isRecord(tree) || tree.truncated !== false || !Array.isArray(tree.tree) ||
      !tree.tree.every((entry) => isRecord(entry) && isNonemptyString(entry.path))) {
    throw new Error('OS repository tree incomplete at selected pin');
  }
  const observedPaths = new Set(tree.tree.map((entry) => entry.path));
  for (const component of componentCatalog()) {
    if (component.pathKind === 'repository-path' && !observedPaths.has(component.path)) {
      throw new Error(`catalog repository path unavailable at ${osPre}: ${component.path}`);
    }
  }
  commands.push(`curl OS git tree @ ${osPre} -> sha256 ${sha256Buffer(Buffer.from(treeText))}`);

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
          preCommit: osHeadPre,
          postCommit: osPost,
          matched: osHeadPre === osPost,
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
          preCommit: zoenHeadPre,
          postCommit: zoenPost,
          matched: zoenHeadPre === zoenPost,
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
    assert.equal(existsSync(ADMISSION_PATH), true, 'commit-pinned admission artifact must be recorded');
    const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8')) as Record<string, unknown>;
    assert.equal(admitBaselineInventory(recorded).ok, true);
    const recRepos = recorded.repositories as Array<Record<string, unknown>>;
    const recordedOs = recRepos.find((repo) => repo.id === OS_REPO.id);
    const recordedZoen = recRepos.find((repo) => repo.id === ZOEN_REPO.id);
    assert.ok(recordedOs && recordedZoen);

    const inventory = runBaselineInventory({ os: String(recordedOs.commit), zoen: String(recordedZoen.commit) });
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

    const recordedLive = recorded.liveDataPreservation as Record<string, unknown>;
    assert.equal(recordedLive.status, 'unresolved');
    assert.equal(recorded.writeCredentialsUsed, false);

    // Read source bytes at the recorded snapshots even when either current head has advanced.
    for (const fresh of repos) {
      const prior = recRepos.find((r) => r.id === fresh.id);
      assert.ok(prior, `recorded repo ${fresh.id}`);
      assert.equal(prior?.commit, fresh.commit);
      assert.deepEqual(prior.license, fresh.license);
      assert.deepEqual(prior.rootManifests, fresh.rootManifests);
    }

    // This real earlier commit remains verifiable after the repository head advances.
    const historicalZoen = '407da157771807ce397529a50a67bc8964a335b6';
    const historical = runBaselineInventory({
      os: String(recordedOs.commit),
      zoen: historicalZoen,
    });
    const historicalRepos = historical.repositories as Array<Record<string, unknown>>;
    assert.equal(historicalRepos.find((r) => r.id === ZOEN_REPO.id)?.commit, historicalZoen);

    const conceptualPaths = new Set([
      'apps/authentication-adapters', 'provider-wiring', 'ui-components',
      'domain-vocabulary', 'database-schema', 'eve-execution-topology',
    ]);
    for (const component of componentCatalog()) {
      if (conceptualPaths.has(component.path)) {
        assert.equal(component.pathKind, 'conceptual-label', `${component.path} is not an observed repository path`);
      }
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

      const duplicateTarget = structuredClone(recorded);
      duplicateTarget.repositories = [recorded.repositories[1], recorded.repositories[1]];
      const duplicateResult = admitBaselineInventory(duplicateTarget, {
        expectedPins: { os: recorded.repositories[0].commit, zoen: recorded.repositories[1].commit },
      });
      assert.equal(duplicateResult.ok, false, 'two target records cannot stand in for the OS repository');

      for (const field of ['license', 'rootManifests']) {
        const missingMetadata = structuredClone(recorded);
        missingMetadata.repositories[0][field] = {};
        assert.equal(admitBaselineInventory(missingMetadata).ok, false, `empty ${field} is incomplete`);
      }
      const missingObservations = structuredClone(recorded);
      delete missingObservations.observations;
      assert.equal(admitBaselineInventory(missingObservations).ok, false, 'observations are required');
      const missingComponent = structuredClone(recorded);
      missingComponent.components.pop();
      assert.equal(admitBaselineInventory(missingComponent).ok, false, 'catalog coverage is required');

      const relabeledConcept = structuredClone(recorded);
      const concept = relabeledConcept.components.find((component: Record<string, unknown>) => component.pathKind === 'conceptual-label');
      assert.ok(concept);
      concept.pathKind = 'repository-path';
      assert.equal(admitBaselineInventory(relabeledConcept).ok, false, 'conceptual labels cannot claim observed repository paths');

      for (const field of ['repositories', 'hashedPackages', 'components']) {
        const nullEntry = structuredClone(recorded);
        nullEntry[field][0] = null;
        assert.equal(admitBaselineInventory(nullEntry).ok, false, `${field} null entry is denied without throwing`);
      }
    }
  });

  test('ZN-0001-BOUNDARY', async () => {
    // Pure transport-result classification. No HTTP peer or service is substituted.
    assert.equal(optionalRawResult({ status: 0, stdout: 'license\n\n200', stderr: '' }), 'license\n');
    assert.equal(optionalRawResult({ status: 0, stdout: '404: Not Found\n404', stderr: '' }), null);
    for (const result of [
      { status: 22, stdout: '\n500', stderr: 'HTTP 500' },
      { status: 6, stdout: '\n000', stderr: 'DNS lookup failed' },
      { status: 60, stdout: '\n000', stderr: 'TLS verification failed' },
      { status: null, stdout: '', stderr: 'curl unavailable' },
    ]) {
      assert.throws(() => optionalRawResult(result), /unavailable/, result.stderr);
    }
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
