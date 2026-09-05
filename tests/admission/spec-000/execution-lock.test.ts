import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { platform as osPlatform, arch as osArch } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const ADMISSION_PATH = join(WORKSPACE_ROOT, 'admissions/spec-000/execution-lock.json');
const SCHEMA_PATH = join(WORKSPACE_ROOT, 'contracts/spec-000/execution-lock.schema.json');
const FIXTURE_PATH = join(WORKSPACE_ROOT, 'tests/fixtures/spec-000/execution-lock.json');
const PACKAGE_JSON_PATH = join(WORKSPACE_ROOT, 'package.json');
const FIXTURE_SEED = 'zn-0002-admission-seed-v1';
const DISABLED_ROUTE = 'core-toolchain-implementation-and-merge';

const CANDIDATE_PACKAGES: Record<string, string> = {
  hono: '4.13.7',
  '@hono/node-server': '2.1.1',
  pg: '8.23.0',
  '@cedar-policy/cedar-wasm': '4.12.0',
  typescript: '6.0.3',
  pnpm: '11.25.0',
};

type AdmitResult =
  | { ok: true; lock: Record<string, unknown> }
  | {
      ok: false;
      blocked: true;
      missingRequirements: string[];
      disabledRoute: string;
      newlyBlockedScope?: string;
    };

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

async function fetchNpmPackage(name: string, version: string) {
  const url = 'https://registry.npmjs.org/' + name.replace('/', '%2F');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm registry ${name}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    versions?: Record<string, { dist?: { integrity?: string; shasum?: string; tarball?: string }; license?: unknown }>;
  };
  const v = data.versions?.[version];
  if (!v?.dist?.integrity) throw new Error(`npm missing ${name}@${version}`);
  const license =
    typeof v.license === 'string'
      ? v.license
      : v.license && typeof v.license === 'object' && 'type' in (v.license as object)
        ? String((v.license as { type: string }).type)
        : null;
  return {
    name,
    version,
    status: 'resolved' as const,
    source: 'https://registry.npmjs.org',
    integrity: v.dist.integrity,
    shasum: v.dist.shasum,
    tarball: v.dist.tarball,
    license,
  };
}

async function resolvePackageMap(): Promise<Record<string, Awaited<ReturnType<typeof fetchNpmPackage>>>> {
  const out: Record<string, Awaited<ReturnType<typeof fetchNpmPackage>>> = {};
  for (const [name, version] of Object.entries(CANDIDATE_PACKAGES)) {
    out[name] = await fetchNpmPackage(name, version);
  }
  return out;
}

function fetchNodeArtifacts(version: string): Array<{ file: string; sha256: string }> {
  const text = execFileSync('curl', ['-fsSL', `https://nodejs.org/dist/${version}/SHASUMS256.txt`], {
    encoding: 'utf8',
  });
  const want = [
    `node-${version}-linux-x64.tar.xz`,
    `node-${version}-linux-arm64.tar.xz`,
    `node-${version}-darwin-x64.tar.gz`,
    `node-${version}-darwin-arm64.tar.gz`,
  ];
  const artifacts: Array<{ file: string; sha256: string }> = [];
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+(\S+)$/);
    if (!m) continue;
    if (want.includes(m[2])) artifacts.push({ file: m[2], sha256: m[1] });
  }
  if (artifacts.length === 0) throw new Error(`no node artifacts for ${version}`);
  return artifacts;
}

function fetchDockerTagDigests(repo: string, tag: string): {
  indexDigest: string;
  platformDigests: Record<string, string>;
} {
  const url = `https://hub.docker.com/v2/repositories/library/${repo}/tags/${tag}`;
  const text = execFileSync('curl', ['-fsSL', url], { encoding: 'utf8' });
  const data = JSON.parse(text) as {
    digest?: string;
    images?: Array<{ architecture?: string; os?: string; digest?: string }>;
  };
  if (!data.digest?.startsWith('sha256:')) throw new Error(`no index digest for ${repo}:${tag}`);
  const platformDigests: Record<string, string> = {};
  for (const img of data.images ?? []) {
    if (img.os === 'linux' && (img.architecture === 'amd64' || img.architecture === 'arm64') && img.digest) {
      platformDigests[img.architecture] = img.digest;
    }
  }
  return { indexDigest: data.digest, platformDigests };
}

function localPostgresDigest(): string | null {
  try {
    return execFileSync(
      'docker',
      ['image', 'inspect', 'postgres:18', '--format', '{{index .RepoDigests 0}}'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return null;
  }
}

function ensureProbeModules(probeDir: string): void {
  mkdirSync(probeDir, { recursive: true });
  const pkgPath = join(probeDir, 'package.json');
  if (!existsSync(pkgPath)) {
    writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: 'zn-0002-probes',
          private: true,
          type: 'module',
          dependencies: {
            hono: CANDIDATE_PACKAGES.hono,
            '@hono/node-server': CANDIDATE_PACKAGES['@hono/node-server'],
            pg: CANDIDATE_PACKAGES.pg,
            '@cedar-policy/cedar-wasm': CANDIDATE_PACKAGES['@cedar-policy/cedar-wasm'],
          },
        },
        null,
        2,
      ) + '\n',
    );
  }
  if (!existsSync(join(probeDir, 'node_modules', 'hono'))) {
    const r = spawnSync(
      'npm',
      [
        'install',
        '--ignore-engines',
        `hono@${CANDIDATE_PACKAGES.hono}`,
        `@hono/node-server@${CANDIDATE_PACKAGES['@hono/node-server']}`,
        `pg@${CANDIDATE_PACKAGES.pg}`,
        `@cedar-policy/cedar-wasm@${CANDIDATE_PACKAGES['@cedar-policy/cedar-wasm']}`,
      ],
      { cwd: probeDir, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`probe npm install failed: ${r.stderr || r.stdout}`);
  }
}

async function importProbe(probeDir: string, pkg: string) {
  const pkgJson = JSON.parse(readFileSync(join(probeDir, 'node_modules', ...pkg.split('/'), 'package.json'), 'utf8')) as {
    exports?: unknown;
    main?: string;
    module?: string;
  };
  // Prefer package exports import condition via native resolution from a data URL importer
  const specifier = pkg;
  const loader = `
    export * from ${JSON.stringify(join(probeDir, 'node_modules', pkg))};
  `;
  // Resolve via createRequire then pathToFileURL for CJS/ESM interop where possible
  const req = createRequire(join(probeDir, 'package.json'));
  let resolved: string;
  try {
    resolved = req.resolve(specifier);
  } catch {
    resolved = join(probeDir, 'node_modules', ...pkg.split('/'), 'esm', 'index.js');
  }
  const { pathToFileURL } = await import('node:url');
  return import(pathToFileURL(resolved).href);
}

async function runHonoStreamingProbe(probeDir: string) {
  const honoMod = await importProbe(probeDir, 'hono');
  const nodeServerMod = await importProbe(probeDir, '@hono/node-server');
  const Hono = honoMod.Hono as new () => { get: Function; fetch: Function };
  const getRequestListener = nodeServerMod.getRequestListener as (
    fetch: Function,
  ) => Parameters<typeof createServer>[0];
  const app = new Hono();
  app.get('/stream', () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk-a;'));
        controller.enqueue(new TextEncoder().encode('chunk-b'));
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'content-type': 'text/plain' } });
  });
  const server = createServer(getRequestListener(app.fetch.bind(app)));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  const res = await fetch(`http://127.0.0.1:${addr.port}/stream`);
  const text = await res.text();
  server.close();
  return {
    status: text === 'chunk-a;chunk-b' ? ('PASS' as const) : ('FAIL' as const),
    observed: text,
    reason: null,
    error: null,
  };
}

async function runPgTransactionProbe(probeDir: string) {
  const pgMod = await importProbe(probeDir, 'pg');
  const pg = (pgMod.default ?? pgMod) as { Client: new (c: object) => {
    connect: () => Promise<void>;
    query: (s: string) => Promise<{ rows: Array<{ v?: string }> }>;
    end: () => Promise<void>;
  } };
  const name = `zn0002_${Date.now()}`;
  try {
    execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        '--name',
        name,
        '-e',
        'POSTGRES_PASSWORD=zn0002',
        '-e',
        'POSTGRES_USER=zn0002',
        '-e',
        'POSTGRES_DB=zn0002',
        '-p',
        '55433:5432',
        'postgres:18',
      ],
      { stdio: 'pipe' },
    );
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'zn0002'], { stdio: 'pipe' });
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!ready) throw new Error('postgres not ready');
    const client = new pg.Client({
      host: '127.0.0.1',
      port: 55433,
      user: 'zn0002',
      password: 'zn0002',
      database: 'zn0002',
    });
    await client.connect();
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE t(id int primary key, v text)');
    await client.query("INSERT INTO t VALUES (1, 'ok')");
    const r = await client.query('SELECT v FROM t WHERE id = 1');
    await client.query('COMMIT');
    await client.end();
    return {
      status: r.rows[0]?.v === 'ok' ? ('PASS' as const) : ('FAIL' as const),
      observed: r.rows[0]?.v ?? null,
      reason: null,
      error: null,
    };
  } catch (e) {
    return {
      status: 'FAIL' as const,
      observed: null,
      reason: null,
      error: String(e),
    };
  } finally {
    try {
      execFileSync('docker', ['stop', name], { stdio: 'pipe' });
    } catch {
      /* ignore */
    }
  }
}

async function runCedarDenyProbe(probeDir: string) {
  // cedar-wasm exposes ESM/wasm; load via absolute file URL under node_modules
  const { pathToFileURL } = await import('node:url');
  const entry = join(probeDir, 'node_modules/@cedar-policy/cedar-wasm/esm/cedar_wasm.js');
  const cedar = (await import(pathToFileURL(entry).href)) as {
    isAuthorized: (call: object) => { type?: string; response?: { decision?: string } };
  };
  const res = cedar.isAuthorized({
    principal: { type: 'User', id: 'alice' },
    action: { type: 'Action', id: 'view' },
    resource: { type: 'Photo', id: 'door' },
    context: {},
    policies: {
      staticPolicies: {
        policy0: 'forbid(principal, action, resource);',
      },
    },
    entities: [
      { uid: { type: 'User', id: 'alice' }, attrs: {}, parents: [] },
      { uid: { type: 'Photo', id: 'door' }, attrs: {}, parents: [] },
      { uid: { type: 'Action', id: 'view' }, attrs: {}, parents: [] },
    ],
  });
  const decision = res?.response?.decision;
  return {
    status: decision === 'deny' ? ('PASS' as const) : ('FAIL' as const),
    observed: decision ?? null,
    reason: null,
    error: null,
  };
}

function runSchemaCanonicalizerProbe() {
  // Exact npm packages for JSON Schema 2020-12 validator and RFC 8785 canonicalizer
  // are not selected in package.json; do not invent pins.
  return {
    status: 'BLOCKED' as const,
    observed: null,
    reason:
      'Exact schema-validator and RFC8785 canonicalizer packages are not selected in package.json; family standards recorded only. Kernel candidate canonicalJson is not an admitted lock entry.',
    error: null,
  };
}

/** Structural admission check aligned to contracts/spec-000/execution-lock.schema.json */
export function admitExecutionLock(
  candidate: unknown,
  options?: { expectedIntegrityDigest?: string; expectedNodeVersion?: string },
): AdmitResult {
  const missingRequirements: string[] = [];

  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      ok: false,
      blocked: true,
      missingRequirements: ['qualification artifact must be a JSON object'],
      disabledRoute: DISABLED_ROUTE,
    };
  }

  const lock = candidate as Record<string, unknown>;
  if (lock.schemaVersion !== 'spec-000.execution-lock.v1') {
    missingRequirements.push('schemaVersion=spec-000.execution-lock.v1');
  }
  if (lock.ticket !== 'ZN-0002') missingRequirements.push('ticket=ZN-0002');
  if (lock.spec !== 'SPEC-000') missingRequirements.push('spec=SPEC-000');
  if (lock.admissionStatus !== 'AdmittedLock' && lock.admissionStatus !== 'BLOCKED') {
    missingRequirements.push('admissionStatus must be AdmittedLock or BLOCKED');
  }

  const toolchain = lock.toolchain as Record<string, unknown> | undefined;
  if (!toolchain || typeof toolchain !== 'object') {
    missingRequirements.push('toolchain');
  } else {
    for (const key of [
      'node',
      'pnpm',
      'typescript',
      'hono',
      'pg',
      'postgresql',
      'cedarBinding',
      'schemaValidator',
      'canonicalizer',
      'testTools',
      'images',
    ]) {
      if (!(key in toolchain)) missingRequirements.push(`toolchain.${key}`);
    }
  }

  const probes = lock.compatibilityProbes as Record<string, unknown> | undefined;
  if (!probes || typeof probes !== 'object') {
    missingRequirements.push('compatibilityProbes');
  } else {
    for (const key of ['honoStreaming', 'pgTransaction', 'cedarDeny', 'schemaCanonicalizer']) {
      const p = probes[key] as Record<string, unknown> | undefined;
      if (!p || !['PASS', 'FAIL', 'BLOCKED'].includes(String(p.status))) {
        missingRequirements.push(`compatibilityProbes.${key}.status`);
      }
    }
  }

  const installs = lock.cleanInstalls as Record<string, unknown> | undefined;
  if (!installs || installs.identicalIntegrity !== true) {
    missingRequirements.push('cleanInstalls.identicalIntegrity must be true');
  }
  if (!Array.isArray(installs?.runs) || (installs!.runs as unknown[]).length < 2) {
    missingRequirements.push('cleanInstalls.runs must include two resolutions');
  }

  if (!Array.isArray(lock.blockers)) missingRequirements.push('blockers array');

  // Incomplete qualification: no toolchain or empty blockers when blocked without probes
  if (lock.admissionStatus === 'AdmittedLock') {
    const blockers = lock.blockers as unknown[];
    if (blockers.length > 0) {
      missingRequirements.push('AdmittedLock cannot retain blockers');
    }
    const probeVals = Object.values((probes ?? {}) as Record<string, { status?: string }>);
    if (probeVals.some((p) => p.status !== 'PASS')) {
      missingRequirements.push('AdmittedLock requires all four probes PASS');
    }
  }

  if (options?.expectedIntegrityDigest && installs) {
    const runs = installs.runs as Array<Record<string, unknown>>;
    for (const run of runs) {
      if (run.integrityDigest !== options.expectedIntegrityDigest) {
        missingRequirements.push(
          `clean-install integrity drift: artifact=${run.integrityDigest} selection=${options.expectedIntegrityDigest}`,
        );
      }
    }
  }

  if (options?.expectedNodeVersion && toolchain) {
    const node = toolchain.node as Record<string, unknown>;
    if (node?.version !== options.expectedNodeVersion) {
      missingRequirements.push(
        `node version drift: artifact=${node?.version} selection=${options.expectedNodeVersion}`,
      );
    }
  }

  if (missingRequirements.length > 0) {
    return {
      ok: false,
      blocked: true,
      missingRequirements,
      disabledRoute: DISABLED_ROUTE,
      newlyBlockedScope: missingRequirements.join('; '),
    };
  }

  return { ok: true, lock };
}

export async function runExecutionLockAdmission(): Promise<Record<string, unknown>> {
  const commands: string[] = [];
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    engines?: { node?: string };
    packageManager?: string;
  };
  const requiredNodeRange = pkg.engines?.node ?? '>=24 <25';
  const localNodeVersion = process.version;
  const major = Number(localNodeVersion.replace(/^v/, '').split('.')[0]);
  const nodeRangeSatisfied = major >= 24 && major < 25;
  let pnpmAvailable = false;
  try {
    execFileSync('pnpm', ['-v'], { stdio: 'pipe' });
    pnpmAvailable = true;
  } catch {
    pnpmAvailable = false;
  }

  const mapA = await resolvePackageMap();
  commands.push('npm registry resolve (run A) for candidate core packages');
  const mapB = await resolvePackageMap();
  commands.push('npm registry resolve (run B) for candidate core packages');
  const digestA = sha256Text(stableStringify(mapA));
  const digestB = sha256Text(stableStringify(mapB));
  const identicalIntegrity = digestA === digestB && stableStringify(mapA) === stableStringify(mapB);

  const nodeVersion = 'v24.20.0';
  const nodeArtifacts = fetchNodeArtifacts(nodeVersion);
  commands.push(`curl https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`);

  const pgDigests = fetchDockerTagDigests('postgres', '18');
  commands.push('curl Docker Hub library/postgres:18 digests');
  const nodeImageDigests = fetchDockerTagDigests('node', '24');
  commands.push('curl Docker Hub library/node:24 digests');
  const localPg = localPostgresDigest();
  commands.push(`docker image inspect postgres:18 -> ${localPg ?? 'absent'}`);

  const probeDir = join(tmpdir(), 'zn-0002-probes');
  ensureProbeModules(probeDir);
  commands.push(`npm install probe packages in ${probeDir}`);

  const honoStreaming = await runHonoStreamingProbe(probeDir);
  commands.push(`probe honoStreaming -> ${honoStreaming.status}`);
  const pgTransaction = await runPgTransactionProbe(probeDir);
  commands.push(`probe pgTransaction -> ${pgTransaction.status}`);
  const cedarDeny = await runCedarDenyProbe(probeDir);
  commands.push(`probe cedarDeny -> ${cedarDeny.status}`);
  const schemaCanonicalizer = runSchemaCanonicalizerProbe();
  commands.push(`probe schemaCanonicalizer -> ${schemaCanonicalizer.status}`);

  const blockers: Array<{ code: string; message: string; component?: string }> = [];
  if (!identicalIntegrity) {
    blockers.push({
      code: 'integrity-mismatch',
      message: 'Two registry resolutions produced different integrity maps',
      component: 'cleanInstalls',
    });
  }
  if (!nodeRangeSatisfied) {
    blockers.push({
      code: 'node-engine-unsatisfied',
      message: `Local Node ${localNodeVersion} does not satisfy package.json engines ${requiredNodeRange}`,
      component: 'node',
    });
  }
  if (!pnpmAvailable) {
    blockers.push({
      code: 'pnpm-unavailable',
      message: 'pnpm binary not available on PATH for workspace install',
      component: 'pnpm',
    });
  }
  if (!existsSync(join(WORKSPACE_ROOT, 'pnpm-lock.yaml'))) {
    blockers.push({
      code: 'pnpm-lock-absent',
      message: 'pnpm-lock.yaml not present; workspace lockfile remains planned pending honest package-manager freeze',
      component: 'pnpm-lock.yaml',
    });
  }
  if (schemaCanonicalizer.status === 'BLOCKED') {
    blockers.push({
      code: 'schema-canonicalizer-unresolved',
      message: schemaCanonicalizer.reason ?? 'schema/canonicalizer unresolved',
      component: 'schemaCanonicalizer',
    });
  }
  for (const [name, probe] of Object.entries({
    honoStreaming,
    pgTransaction,
    cedarDeny,
    schemaCanonicalizer,
  })) {
    if (probe.status === 'FAIL') {
      blockers.push({
        code: `probe-fail-${name}`,
        message: probe.error ?? `probe ${name} failed`,
        component: name,
      });
    }
    if (probe.status === 'BLOCKED') {
      // already recorded for schema; still note any other blocked probe
      if (name !== 'schemaCanonicalizer') {
        blockers.push({
          code: `probe-blocked-${name}`,
          message: probe.reason ?? `probe ${name} blocked`,
          component: name,
        });
      }
    }
  }

  // verify:ticket still planned
  const verifyTicketPlanned = !existsSync(join(WORKSPACE_ROOT, 'tooling/verify-ticket.ts'))
    ? false
    : readFileSync(join(WORKSPACE_ROOT, 'tooling/verify-ticket.ts'), 'utf8').includes('@zoen-plan');
  if (verifyTicketPlanned || !readFileSync(PACKAGE_JSON_PATH, 'utf8').includes('verify:ticket')) {
    blockers.push({
      code: 'verify-ticket-planned',
      message: 'pnpm verify:ticket is still planned / not wired in package.json scripts',
      component: 'verify:ticket',
    });
  }

  const admissionStatus = blockers.length === 0 ? 'AdmittedLock' : 'BLOCKED';

  const lock: Record<string, unknown> = {
    schemaVersion: 'spec-000.execution-lock.v1',
    ticket: 'ZN-0002',
    spec: 'SPEC-000',
    admissionStatus,
    profile: 'admission-core-toolchain',
    producedAt: new Date().toISOString(),
    disabledRoute: DISABLED_ROUTE,
    toolchain: {
      node: {
        family: 'Node.js 24 LTS',
        version: nodeVersion,
        status: 'resolved',
        source: 'https://nodejs.org/dist/index.json + SHASUMS256.txt',
        ltsCodename: 'Krypton',
        artifacts: nodeArtifacts,
        notes: `package.json engines=${requiredNodeRange}; local process.version=${localNodeVersion}; nodeRangeSatisfied=${nodeRangeSatisfied}`,
      },
      pnpm: {
        ...mapA.pnpm,
        family: 'pnpm 11',
        notes: `packageManager field pnpm@11.25.0; pnpmAvailable=${pnpmAvailable}`,
      },
      typescript: {
        ...mapA.typescript,
        family: 'TypeScript 6 compatibility baseline',
      },
      hono: {
        ...mapA.hono,
        family: 'Hono 4',
      },
      honoNodeServer: {
        ...mapA['@hono/node-server'],
        family: 'Hono official Node adapter',
      },
      pg: {
        ...mapA.pg,
        family: 'node-postgres (pg)',
      },
      postgresql: {
        name: 'postgres',
        tag: '18',
        status: 'resolved',
        source: 'https://hub.docker.com/v2/repositories/library/postgres/tags/18',
        indexDigest: pgDigests.indexDigest,
        platformDigests: pgDigests.platformDigests,
        localRepoDigest: localPg,
        family: 'PostgreSQL 18',
        notes: 'Image digests from Docker Hub; localRepoDigest recorded when image present',
      },
      cedarBinding: {
        ...mapA['@cedar-policy/cedar-wasm'],
        family: 'Cedar evaluator behind PolicyPort',
      },
      schemaValidator: {
        id: 'schema-validator',
        family: 'JSON Schema 2020-12',
        status: 'BLOCKED',
        source: 'technology-stack.md family selection; package.json has no exact validator pin',
        name: null,
        version: null,
        integrity: null,
        notes: 'Exact npm package within family not selected; do not invent ajv/other pin',
      },
      canonicalizer: {
        id: 'canonicalizer',
        family: 'canonical JSON (RFC 8785 profile)',
        status: 'BLOCKED',
        source: 'technology-stack.md family selection; package.json has no exact canonicalizer pin',
        name: null,
        version: null,
        integrity: null,
        notes: 'Kernel candidate canonicalJson is not an admitted lock entry',
      },
      testTools: {
        entries: [
          {
            id: 'node-test',
            family: 'node:test (bundled with Node runtime)',
            status: 'resolved',
            source: 'Node.js runtime',
            name: 'node:test',
            version: nodeVersion,
            integrity: null,
            notes: 'Built-in test runner used for this admission suite',
          },
          {
            id: 'vitest',
            family: 'Vitest (law/property layer; ZN-0004)',
            status: 'BLOCKED',
            source: 'docs/testing/strategy.md; not pinned in package.json',
            name: null,
            version: null,
            integrity: null,
            notes: 'Exact vitest pin deferred; do not invent version',
          },
          {
            id: 'playwright',
            family: 'Playwright (journey/browser; ZN-0004)',
            status: 'BLOCKED',
            source: 'docs/testing/strategy.md; not pinned in package.json',
            name: null,
            version: null,
            integrity: null,
            notes: 'Exact playwright pin deferred; do not invent version',
          },
        ],
      },
      images: [
        {
          name: 'postgres',
          tag: '18',
          status: 'resolved',
          source: 'https://hub.docker.com/v2/repositories/library/postgres/tags/18',
          indexDigest: pgDigests.indexDigest,
          platformDigests: pgDigests.platformDigests,
          localRepoDigest: localPg,
          family: 'PostgreSQL 18',
        },
        {
          name: 'node',
          tag: '24',
          status: 'resolved',
          source: 'https://hub.docker.com/v2/repositories/library/node/tags/24',
          indexDigest: nodeImageDigests.indexDigest,
          platformDigests: nodeImageDigests.platformDigests,
          localRepoDigest: null,
          family: 'Node.js 24 OCI',
        },
      ],
    },
    compatibilityProbes: {
      honoStreaming,
      pgTransaction,
      cedarDeny,
      schemaCanonicalizer,
    },
    cleanInstalls: {
      method: 'two independent npm registry resolutions of candidate package set (integrity maps)',
      runs: [
        { id: 'A', resolvedCount: Object.keys(mapA).length, integrityDigest: digestA },
        { id: 'B', resolvedCount: Object.keys(mapB).length, integrityDigest: digestB },
      ],
      identicalIntegrity,
    },
    environment: {
      localNodeVersion,
      requiredNodeRange,
      nodeRangeSatisfied,
      pnpmAvailable,
      platform: osPlatform(),
      arch: osArch(),
      notes:
        'Recorded honestly from process/runtime. Node may be provided via nvm (.toolchain-env.sh). Do not fake Node 24 when process reports otherwise.',
    },
    observations: {
      commands,
      fixtureSeed: FIXTURE_SEED,
      profile: 'admission-core-toolchain',
    },
    blockers,
  };

  const admitted = admitExecutionLock(lock);
  if (!admitted.ok) {
    throw new Error(`lock failed structural admission: ${admitted.missingRequirements.join('; ')}`);
  }
  return lock;
}

function registerZn0002Tests(): void {
  test('ZN-0002-AC', async () => {
    assert.equal(existsSync(SCHEMA_PATH), true, 'schema must exist for admission boundary');

    const lock = await runExecutionLockAdmission();
    const admitted = admitExecutionLock(lock);
    assert.equal(admitted.ok, true);

    const installs = lock.cleanInstalls as Record<string, unknown>;
    assert.equal(installs.identicalIntegrity, true);
    const runs = installs.runs as Array<Record<string, unknown>>;
    assert.equal(runs.length, 2);
    assert.equal(runs[0]?.integrityDigest, runs[1]?.integrityDigest);

    const probes = lock.compatibilityProbes as Record<string, { status: string }>;
    assert.ok(probes.honoStreaming);
    assert.ok(probes.pgTransaction);
    assert.ok(probes.cedarDeny);
    assert.ok(probes.schemaCanonicalizer);

    // Any missing binary or failing/blocked probe blocks core admission
    const blockedProbe = Object.values(probes).some((p) => p.status !== 'PASS');
    if (blockedProbe) {
      assert.equal(lock.admissionStatus, 'BLOCKED');
      assert.ok(Array.isArray(lock.blockers) && (lock.blockers as unknown[]).length > 0);
    }

    // Real integrity present for resolvable packages
    const toolchain = lock.toolchain as Record<string, Record<string, unknown>>;
    for (const key of ['hono', 'pg', 'typescript', 'pnpm', 'cedarBinding']) {
      assert.match(String(toolchain[key]?.integrity), /^sha512-/);
      assert.equal(toolchain[key]?.status, 'resolved');
    }
    assert.match(String((toolchain.postgresql as { indexDigest?: string }).indexDigest), /^sha256:/);
    assert.equal((toolchain.schemaValidator as { status: string }).status, 'BLOCKED');
    assert.equal((toolchain.canonicalizer as { status: string }).status, 'BLOCKED');

    assert.equal(existsSync(ADMISSION_PATH), true, 'commit-pinned admission artifact must be recorded');
    const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8')) as Record<string, unknown>;
    assert.equal(admitExecutionLock(recorded).ok, true);
    assert.equal(recorded.admissionStatus, 'BLOCKED');
  });

  test('ZN-0002-NEG', async () => {
    assert.equal(existsSync(FIXTURE_PATH), true);
    const incomplete = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
    const result = admitExecutionLock(incomplete);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.blocked, true);
    assert.ok(result.missingRequirements.length > 0);
    assert.equal(result.disabledRoute, DISABLED_ROUTE);
    assert.match(
      result.missingRequirements.join(' '),
      /schemaVersion|toolchain|compatibilityProbes|cleanInstalls/,
    );

    if (existsSync(ADMISSION_PATH)) {
      const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8'));
      assert.notDeepEqual(recorded, incomplete);
      assert.equal(admitExecutionLock(recorded).ok, true);
    }
  });

  test('ZN-0002-BOUNDARY', async () => {
    assert.equal(existsSync(ADMISSION_PATH), true);
    const recorded = JSON.parse(readFileSync(ADMISSION_PATH, 'utf8')) as Record<string, unknown>;
    assert.equal(admitExecutionLock(recorded).ok, true);

    const installs = recorded.cleanInstalls as { runs: Array<{ integrityDigest: string }> };
    const previousDigest = installs.runs[0]!.integrityDigest;

    const changedVersion = structuredClone(recorded) as Record<string, unknown>;
    const toolchain = changedVersion.toolchain as Record<string, Record<string, unknown>>;
    const previousNode = String(toolchain.node.version);
    toolchain.node.version = 'v24.0.0';
    const nodeReplay = admitExecutionLock(changedVersion, {
      expectedNodeVersion: previousNode,
      expectedIntegrityDigest: previousDigest,
    });
    assert.equal(nodeReplay.ok, false);
    if (nodeReplay.ok) return;
    assert.equal(nodeReplay.blocked, true);
    assert.ok(
      nodeReplay.missingRequirements.some((m) => m.includes('node version drift')),
      nodeReplay.missingRequirements.join('; '),
    );
    assert.equal(nodeReplay.newlyBlockedScope?.includes('node version drift'), true);

    const changedDigest = structuredClone(recorded) as Record<string, unknown>;
    const runs = (changedDigest.cleanInstalls as { runs: Array<Record<string, unknown>> }).runs;
    runs[0]!.integrityDigest = '0'.repeat(64);
    runs[1]!.integrityDigest = '0'.repeat(64);
    const digestReplay = admitExecutionLock(changedDigest, {
      expectedIntegrityDigest: previousDigest,
    });
    assert.equal(digestReplay.ok, false);
    if (digestReplay.ok) return;
    assert.ok(
      digestReplay.missingRequirements.some((m) => m.includes('clean-install integrity drift')),
    );
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0002_RUN_TESTS === '1') {
  registerZn0002Tests();
}
