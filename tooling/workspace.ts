/**
 * ZN-0003 — workspace layout, strict build scripts and dependency boundaries.
 * Static checker only; does not admit new toolchain packages or fabricate digests.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WORKSPACE_ROOT = resolve(HERE, '..');

export const REQUIRED_APPS = [
  'edge',
  'web',
  'eve-worker',
  'authority-worker',
  'effect-worker',
] as const;

export const REQUIRED_PACKAGES = [
  'kernel',
  'contracts',
  'door',
  'ontology',
  'eve',
  'clients',
  'adapters',
  'telemetry',
] as const;

export const REQUIRED_SCRIPTS = [
  'check',
  'test:law',
  'test:component',
  'test:journey',
  'verify:ticket',
] as const;

export const REQUIRED_CONFIGS = [
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'eslint.config.mjs',
  '.dependency-cruiser.cjs',
  'contracts/spec-000/workspace.schema.json',
] as const;

export const DISABLED_ROUTE = 'workspace-boundaries-implementation-and-merge';
export const SCHEMA_VERSION = 'spec-000.workspace.v1';
export const FIXTURE_SEED = 'zn-0003-workspace-seed-v1';

export type WorkspaceFinding = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
};

export type WorkspaceReport = {
  schemaVersion: string;
  ticket: 'ZN-0003';
  spec: 'SPEC-000';
  profile: string;
  status: 'Certified' | 'Rejected';
  layout: {
    apps: string[];
    packages: string[];
    missingApps: string[];
    missingPackages: string[];
  };
  scripts: {
    present: string[];
    missing: string[];
  };
  configs: {
    present: string[];
    missing: string[];
  };
  dependencyBoundaries: {
    forbiddenEdges: Array<{ from: string; to: string; detail: string }>;
    allowedSamples: string[];
  };
  placeholderRoutes: string[];
  schemaGeneration: {
    status: 'reproducible-source-present' | 'BLOCKED';
    notes: string;
  };
  toolAdmission: {
    typescript: 'admitted-local';
    eslintPackage: 'not-admitted';
    dependencyCruiserPackage: 'not-admitted';
    notes: string;
  };
  artifactDigest: string | null;
  findings: WorkspaceFinding[];
  disabledRoute: string;
  observations: {
    fixtureSeed: string;
    commands: string[];
  };
};


const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const PLACEHOLDER_ROUTE_RE =
  /(?:app\.(?:get|post|all|use)\s*\(\s*['`][^'`]*placeholder[^'`]*['`])|(?:FAKE_PROVIDER)|(?:return\s+\{\s*ok\s*:\s*true\s*\}\s*;\s*\/\*\s*provider)/i;

function hasPlaceholderRoute(text: string): boolean {
  if (PLACEHOLDER_ROUTE_RE.test(text)) return true;
  // Explicit mounted path containing "placeholder" (not prose comments alone).
  if (/\b(?:get|post|all|use)\(\s*['`]\/[^'`]*placeholder[^'`]*['`]/i.test(text)) return true;
  if (/['`]\/api\/placeholder(?:-[^'`]+)?['`]/i.test(text)) return true;
  return false;
}

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

function listDirs(root: string, sub: string): string[] {
  const dir = join(root, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => {
      try {
        return statSync(join(dir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function walkSourceFiles(root: string, relDir: string): string[] {
  const abs = join(root, relDir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const stack = [abs];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name === 'dist' || name === '.core-build') continue;
      const p = join(cur, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(p);
      else if (/\.(ts|tsx|mjs|cjs|js)$/.test(name) && !name.endsWith('.plan.md')) out.push(p);
    }
  }
  return out.sort();
}

function isCommentOnlyPlan(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith('// @zoen-plan') && !lines[0]?.startsWith('# @zoen-plan')) return false;
  return lines.every((line) => {
    const t = line.trim();
    return t === '' || t.startsWith('//') || t.startsWith('#');
  });
}

function extractImports(text: string): string[] {
  const found: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec) found.push(spec);
  }
  return found;
}

function readPackageScripts(root: string): Record<string, string> {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return {};
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  return pkg.scripts ?? {};
}

function validatePnpmWorkspace(root: string): WorkspaceFinding[] {
  const findings: WorkspaceFinding[] = [];
  const path = join(root, 'pnpm-workspace.yaml');
  if (!existsSync(path)) {
    findings.push({
      code: 'missing-pnpm-workspace',
      severity: 'error',
      message: 'pnpm-workspace.yaml missing',
      path: 'pnpm-workspace.yaml',
    });
    return findings;
  }
  const text = readFileSync(path, 'utf8');
  if (!/packages\s*:/.test(text) || !/apps\/\*/.test(text) || !/packages\/\*/.test(text)) {
    findings.push({
      code: 'incomplete-pnpm-workspace',
      severity: 'error',
      message: 'pnpm-workspace.yaml must declare packages: apps/* and packages/*',
      path: 'pnpm-workspace.yaml',
    });
  }
  return findings;
}

function scanBoundaries(root: string): {
  forbiddenEdges: Array<{ from: string; to: string; detail: string }>;
  findings: WorkspaceFinding[];
} {
  const forbiddenEdges: Array<{ from: string; to: string; detail: string }> = [];
  const findings: WorkspaceFinding[] = [];

  const rules: Array<{
    fromGlobs: string[];
    code: string;
    check: (text: string, imports: string[]) => string | null;
  }> = [
    {
      fromGlobs: ['packages/eve/'],
      code: 'eve-forbidden-pg-adapter',
      check: (text, imports) => {
        for (const spec of imports) {
          if (spec === 'pg' || /(?:^|\/)adapters\/src\/pg(?:\.js)?$/.test(spec) || spec === '@zoen/adapters/pg') {
            return spec;
          }
        }
        if (/\bfrom\s+['"]pg['"]/.test(text) || /\brequire\s*\(\s*['"]pg['"]\s*\)/.test(text)) return 'pg';
        return null;
      },
    },
    {
      fromGlobs: ['apps/web/'],
      code: 'web-forbidden-authority-credential',
      check: (text, imports) => {
        for (const spec of imports) {
          if (spec === 'pg' || /(?:^|\/)adapters\/src\/pg(?:\.js)?$/.test(spec) || /(?:^|\/)adapters\/src\/config(?:\.js)?$/.test(spec)) {
            return spec;
          }
        }
        if (/process\.env\.(?:AUTHORITY_CREDENTIAL|AUTHORITY_DATABASE_URL|ZOEN_AUTHORITY_DATABASE_URL|SOURCE_PROVIDER_SECRET)\b/.test(text)) {
          return 'authority-credential-read';
        }
        return null;
      },
    },
    {
      fromGlobs: ['apps/eve-worker/'],
      code: 'eve-worker-forbidden-authority-credential',
      check: (text, imports) => {
        for (const spec of imports) {
          if (spec === 'pg' || /(?:^|\/)adapters\/src\/pg(?:\.js)?$/.test(spec) || /(?:^|\/)adapters\/src\/config(?:\.js)?$/.test(spec)) {
            return spec;
          }
        }
        if (/process\.env\.(?:AUTHORITY_CREDENTIAL|AUTHORITY_DATABASE_URL|ZOEN_AUTHORITY_DATABASE_URL)\b/.test(text)) {
          return 'authority-credential-read';
        }
        return null;
      },
    },
    {
      fromGlobs: ['packages/kernel/'],
      code: 'kernel-forbidden-application-io',
      check: (text, imports) => {
        for (const spec of imports) {
          if (spec === 'pg' || spec === 'hono' || spec.startsWith('node:fs') || spec.startsWith('node:net') || spec.startsWith('node:http') || spec.includes('/apps/')) {
            return spec;
          }
        }
        return null;
      },
    },
  ];

  for (const rule of rules) {
    for (const fromGlob of rule.fromGlobs) {
      for (const file of walkSourceFiles(root, fromGlob.replace(/\/$/, ''))) {
        const text = readFileSync(file, 'utf8');
        if (isCommentOnlyPlan(text)) continue;
        const relFile = relative(root, file).split(sep).join('/');
        const imports = extractImports(text);
        const hit = rule.check(text, imports);
        if (hit) {
          forbiddenEdges.push({ from: relFile, to: hit, detail: rule.code });
          findings.push({
            code: rule.code,
            severity: 'error',
            message: `Forbidden dependency edge: ${relFile} -> ${hit}`,
            path: relFile,
          });
        }
      }
    }
  }
  return { forbiddenEdges, findings };
}

function scanPlaceholderRoutes(root: string): { routes: string[]; findings: WorkspaceFinding[] } {
  const routes: string[] = [];
  const findings: WorkspaceFinding[] = [];
  for (const app of REQUIRED_APPS) {
    for (const file of walkSourceFiles(root, join('apps', app))) {
      const text = readFileSync(file, 'utf8');
      if (isCommentOnlyPlan(text)) continue;
      if (hasPlaceholderRoute(text)) {
        const relFile = relative(root, file).split(sep).join('/');
        routes.push(relFile);
        findings.push({
          code: 'placeholder-route-exposed',
          severity: 'error',
          message: `Placeholder route pattern detected in ${relFile}`,
          path: relFile,
        });
      }
    }
  }
  return { routes, findings };
}

function unitHasEntry(root: string, kind: 'apps' | 'packages', name: string): boolean {
  return (
    existsSync(join(root, kind, name, 'package.json')) &&
    existsSync(join(root, kind, name, 'tsconfig.json')) &&
    existsSync(join(root, kind, name, 'src', 'index.ts'))
  );
}

export function checkWorkspace(
  root: string = DEFAULT_WORKSPACE_ROOT,
  options?: { profile?: string; fixtureSeed?: string; commands?: string[] },
): WorkspaceReport {
  const profile = options?.profile ?? 'static-workspace-boundaries';
  const findings: WorkspaceFinding[] = [];
  const apps = listDirs(root, 'apps');
  const packages = listDirs(root, 'packages');
  const missingApps = REQUIRED_APPS.filter((a) => !unitHasEntry(root, 'apps', a));
  const missingPackages = REQUIRED_PACKAGES.filter((p) => !unitHasEntry(root, 'packages', p));
  for (const a of missingApps) {
    findings.push({
      code: 'missing-app-unit',
      severity: 'error',
      message: `Missing required app unit apps/${a} (package.json, tsconfig.json, src/index.ts)`,
      path: `apps/${a}`,
    });
  }
  for (const p of missingPackages) {
    findings.push({
      code: 'missing-package-unit',
      severity: 'error',
      message: `Missing required package unit packages/${p} (package.json, tsconfig.json, src/index.ts)`,
      path: `packages/${p}`,
    });
  }

  findings.push(...validatePnpmWorkspace(root));

  const scripts = readPackageScripts(root);
  const presentScripts = REQUIRED_SCRIPTS.filter((s) => typeof scripts[s] === 'string' && scripts[s]!.length > 0);
  const missingScripts = REQUIRED_SCRIPTS.filter((s) => !presentScripts.includes(s));
  for (const s of missingScripts) {
    findings.push({
      code: 'missing-required-script',
      severity: 'error',
      message: `package.json scripts missing required entry: ${s}`,
      path: 'package.json',
    });
  }

  const presentConfigs = REQUIRED_CONFIGS.filter((c) => existsSync(join(root, c)));
  const missingConfigs = REQUIRED_CONFIGS.filter((c) => !presentConfigs.includes(c));
  for (const c of missingConfigs) {
    findings.push({
      code: 'missing-required-config',
      severity: 'error',
      message: `Missing required config: ${c}`,
      path: c,
    });
  }

  // Strict TypeScript: require root tsconfig strict flags
  const tsconfigPath = join(root, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    try {
      const ts = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as {
        compilerOptions?: Record<string, unknown>;
      };
      const opts = ts.compilerOptions ?? {};
      for (const flag of ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'noEmitOnError']) {
        if (opts[flag] !== true) {
          findings.push({
            code: 'typescript-not-strict',
            severity: 'error',
            message: `tsconfig.json compilerOptions.${flag} must be true`,
            path: 'tsconfig.json',
          });
        }
      }
    } catch (e) {
      findings.push({
        code: 'typescript-config-invalid',
        severity: 'error',
        message: `tsconfig.json parse failed: ${e instanceof Error ? e.message : String(e)}`,
        path: 'tsconfig.json',
      });
    }
  }

  const boundaries = scanBoundaries(root);
  findings.push(...boundaries.findings);
  const placeholders = scanPlaceholderRoutes(root);
  findings.push(...placeholders.findings);

  const schemaPath = join(root, 'contracts/spec-000/workspace.schema.json');
  const schemaGeneration = existsSync(schemaPath)
    ? {
        status: 'reproducible-source-present' as const,
        notes:
          'Workspace report schema is the reviewed source; generated wire types must derive from it when generation is admitted. No fabricated digest recorded.',
      }
    : {
        status: 'BLOCKED' as const,
        notes: 'contracts/spec-000/workspace.schema.json missing; generation is not reproducible',
      };
  if (schemaGeneration.status === 'BLOCKED') {
    findings.push({
      code: 'schema-source-missing',
      severity: 'error',
      message: schemaGeneration.notes,
      path: 'contracts/spec-000/workspace.schema.json',
    });
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const reportWithoutDigest: Omit<WorkspaceReport, 'artifactDigest'> & { artifactDigest: null } = {
    schemaVersion: SCHEMA_VERSION,
    ticket: 'ZN-0003',
    spec: 'SPEC-000',
    profile,
    status: errors.length === 0 ? 'Certified' : 'Rejected',
    layout: {
      apps,
      packages,
      missingApps: [...missingApps],
      missingPackages: [...missingPackages],
    },
    scripts: { present: [...presentScripts], missing: [...missingScripts] },
    configs: { present: [...presentConfigs], missing: [...missingConfigs] },
    dependencyBoundaries: {
      forbiddenEdges: boundaries.forbiddenEdges,
      allowedSamples: [
        'packages/eve -> packages/contracts/src/ports (port types)',
        'apps/web -> packages/clients (semantic client)',
        'packages/kernel -> (no apps/pg/hono)',
      ],
    },
    placeholderRoutes: placeholders.routes,
    schemaGeneration,
    toolAdmission: {
      typescript: 'admitted-local',
      eslintPackage: 'not-admitted',
      dependencyCruiserPackage: 'not-admitted',
      notes:
        'eslint.config.mjs and .dependency-cruiser.cjs encode the same forbidden edges; npm packages eslint and dependency-cruiser are not in the ZN-0002 core lock. This checker enforces equivalent static rules without inventing package digests.',
    },
    artifactDigest: null,
    findings,
    disabledRoute: DISABLED_ROUTE,
    observations: {
      fixtureSeed: options?.fixtureSeed ?? FIXTURE_SEED,
      commands: options?.commands ?? ['workspace.check'],
    },
  };

  const artifactDigest = sha256Text(stableStringify(reportWithoutDigest));
  return { ...reportWithoutDigest, artifactDigest };
}

export function certifyWorkspace(root: string = DEFAULT_WORKSPACE_ROOT): {
  ok: true;
  report: WorkspaceReport;
} | {
  ok: false;
  report: WorkspaceReport;
  exitCode: number;
} {
  const report = checkWorkspace(root);
  if (report.status === 'Certified') return { ok: true, report };
  return { ok: false, report, exitCode: 1 };
}

export function assertRequiredChecks(executedIds: string[], requiredIds: readonly string[]): void {
  if (executedIds.length === 0) {
    throw new Error('zero-test run rejected: executed_count must be > 0');
  }
  const missing = requiredIds.filter((id) => !executedIds.includes(id));
  if (missing.length) {
    throw new Error(`missing required checks: ${missing.join(', ')}`);
  }
}

export function writeReport(report: WorkspaceReport, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
}

function printCliHelp(): void {
  process.stdout.write(
    [
      'Usage: node --experimental-strip-types tooling/workspace.ts <command>',
      '  check              Run layout/script/boundary checks; exit 1 on rejection',
      '  report [path]      Write JSON report (default evidence/workspace-v5/zn-0003-workspace.json)',
      '  verify-ticket-gate Fail closed until ZN-0005 wires verify:ticket',
      '',
    ].join('\n'),
  );
}

function main(argv: string[]): number {
  const cmd = argv[0] ?? 'check';
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printCliHelp();
    return 0;
  }
  if (cmd === 'verify-ticket-gate') {
    process.stderr.write(
      'BLOCKED: pnpm verify:ticket remains planned until ZN-0005; refusing to certify.\n',
    );
    return 1;
  }
  if (cmd === 'journey-gate') {
    process.stderr.write(
      'BLOCKED: test:journey requires admitted journey harness (ZN-0004+); zero/placeholder journey runs are rejected.\n',
    );
    return 1;
  }
  if (cmd === 'check' || cmd === 'report') {
    const result = certifyWorkspace(DEFAULT_WORKSPACE_ROOT);
    const out =
      argv[1] ??
      join(DEFAULT_WORKSPACE_ROOT, 'evidence/workspace-v5/zn-0003-workspace.json');
    if (cmd === 'report' || result.ok) {
      writeReport(result.report, out);
    }
    if (!result.ok) {
      process.stderr.write(
        `Rejected workspace boundaries (${result.report.findings.filter((f) => f.severity === 'error').length} errors)\n`,
      );
      for (const f of result.report.findings.filter((x) => x.severity === 'error').slice(0, 20)) {
        process.stderr.write(`- ${f.code}: ${f.message}\n`);
      }
      return result.exitCode;
    }
    process.stdout.write(`Certified workspace boundaries digest=${result.report.artifactDigest}\n`);
    return 0;
  }
  process.stderr.write(`Unknown command: ${cmd}\n`);
  printCliHelp();
  return 2;
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === thisFile) {
  process.exit(main(process.argv.slice(2)));
}
