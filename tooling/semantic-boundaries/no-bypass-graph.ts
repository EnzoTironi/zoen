import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { BoundaryFinding, ForbiddenEdge, NoBypassReport, RootKind } from './types.js';
import type { NoBypassGraphPort } from './ports.js';

export const NO_BYPASS_SCHEMA_VERSION = 'spec-050.no-bypass-graph.v1';
export const NO_BYPASS_FIXTURE_SEED = 'zn-0292-no-bypass-seed-v1';

/** Trusted executor / repository composition roots (may touch pg / credentials). */
export const TRUSTED_ROOTS = Object.freeze([
  'apps/authority-worker/',
  'packages/ontology/',
  'packages/adapters/',
  'packages/kernel/',
  'db/',
  'tooling/',
] as const);

/** Untrusted human, agent, app and runner client roots. */
export const CLIENT_ROOTS = Object.freeze([
  'apps/web/',
  'apps/eve-worker/',
  'apps/edge/src/routes/',
  'packages/eve/',
  'packages/clients/',
  'runners/',
] as const);

const FORBIDDEN_SPEC_RES = Object.freeze([
  { code: 'client-forbidden-pg', re: /(?:^|\/)(?:pg)$|(?:^|\/)adapters\/src\/pg(?:\.js)?$|@zoen\/adapters\/pg/ },
  { code: 'client-forbidden-sql-client', re: /(?:^|\/)adapters\/src\/(?:config|sql|index-client)(?:\.js)?$|@zoen\/adapters\/(?:config|sql)/ },
  { code: 'client-forbidden-repository', re: /(?:^|\/)ontology\/src\/(?:authority|evidence)(?:\/|$)|@zoen\/ontology\/(?:authority|evidence)/ },
] as const);

const CREDENTIAL_RE =
  /process\.env\.(?:AUTHORITY_CREDENTIAL|AUTHORITY_DATABASE_URL|ZOEN_AUTHORITY_DATABASE_URL|SOURCE_PROVIDER_SECRET|ZOEN_SOURCE_SECRET|AWS_SECRET_ACCESS_KEY)\b/;

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const ALIAS_HINT_RE =
  /(?:from|require\s*\(|import\s*\()\s*['"](?:@\/|#\/|~\/)(?:.*pg.*|.*adapters\/pg.*)['"]/;

function posix(rel: string): string {
  return rel.split(sep).join('/');
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
      if (name === 'node_modules' || name === 'dist' || name === '.core-build' || name === '.git') continue;
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

export function classifyRoot(relFile: string): RootKind {
  const path = posix(relFile);
  if (CLIENT_ROOTS.some((r) => path.startsWith(r) || path.includes('/mini-apps/') || path.includes('/app-host/'))) {
    return 'client';
  }
  if (TRUSTED_ROOTS.some((r) => path.startsWith(r))) return 'trusted-composition';
  if (path.startsWith('packages/contracts/') || path.startsWith('packages/clients/src/semantic-client')) {
    return 'shared-contracts';
  }
  return 'unknown';
}

function isSemanticClientImport(spec: string): boolean {
  return (
    /semantic-client(?:\.js)?$/.test(spec) ||
    spec === '@zoen/contracts/semantic-client' ||
    /(?:^|\/)contracts\/src\/semantic-client(?:\.js)?$/.test(spec) ||
    /(?:^|\/)clients\/src\/semantic-client(?:\.js)?$/.test(spec) ||
    /semantic-client/.test(spec)
  );
}

function isForbiddenSpec(spec: string): { code: string; to: string } | null {
  for (const rule of FORBIDDEN_SPEC_RES) {
    if (rule.re.test(spec)) return { code: rule.code, to: spec };
  }
  // Barrel reexport path hints
  if (/(?:^|\/)(?:pg-barrel|db-barrel|sql-barrel)(?:\.js)?$/.test(spec)) {
    return { code: 'client-forbidden-pg-barrel', to: spec };
  }
  return null;
}

export type CheckOptions = Readonly<{
  fixtureSeed?: string;
  /** When true, require at least one selected source file (BOUNDARY). */
  requireNonEmpty?: boolean;
}>;

/**
 * Static gate: client roots may not import repositories, SQL/pg adapters or
 * source credentials — including via barrels, aliases and dynamic import().
 */
export function checkNoBypassGraph(root: string, options: CheckOptions = {}): NoBypassReport {
  const findings: BoundaryFinding[] = [];
  const forbiddenEdges: ForbiddenEdge[] = [];
  const allowedSemanticClientImports: string[] = [];
  const requireNonEmpty = options.requireNonEmpty !== false;
  const fixtureSeed = options.fixtureSeed ?? NO_BYPASS_FIXTURE_SEED;

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    findings.push({
      code: 'disconnected-checker',
      severity: 'error',
      message: `Checker root missing or not a directory: ${root}`,
      path: root,
    });
    return Object.freeze({
      schemaVersion: NO_BYPASS_SCHEMA_VERSION,
      ticket: 'ZN-0292',
      spec: 'SPEC-050',
      status: 'Rejected',
      selectedFileCount: 0,
      clientRoots: [...CLIENT_ROOTS],
      trustedRoots: [...TRUSTED_ROOTS],
      forbiddenEdges: [],
      allowedSemanticClientImports: [],
      findings,
      fixtureSeed,
    });
  }

  const selected: string[] = [];
  for (const prefix of [...CLIENT_ROOTS, ...TRUSTED_ROOTS, 'packages/contracts/', 'apps/web/src/mini-apps/']) {
    for (const file of walkSourceFiles(root, prefix.replace(/\/$/, ''))) {
      selected.push(file);
    }
  }
  // Deduplicate
  const uniqueFiles = [...new Set(selected)].sort();

  if (requireNonEmpty && uniqueFiles.length === 0) {
    findings.push({
      code: 'empty-graph',
      severity: 'error',
      message: 'Zero selected files — refusing to certify an empty module graph',
      path: root,
    });
    return Object.freeze({
      schemaVersion: NO_BYPASS_SCHEMA_VERSION,
      ticket: 'ZN-0292',
      spec: 'SPEC-050',
      status: 'Rejected',
      selectedFileCount: 0,
      clientRoots: [...CLIENT_ROOTS],
      trustedRoots: [...TRUSTED_ROOTS],
      forbiddenEdges: [],
      allowedSemanticClientImports: [],
      findings,
      fixtureSeed,
    });
  }

  for (const file of uniqueFiles) {
    const text = readFileSync(file, 'utf8');
    if (isCommentOnlyPlan(text)) continue;
    const relFile = posix(relative(root, file));
    const kind = classifyRoot(relFile);
    if (kind !== 'client') continue;

    const imports = extractImports(text);
    for (const spec of imports) {
      if (isSemanticClientImport(spec)) {
        allowedSemanticClientImports.push(`${relFile} -> ${spec}`);
        continue;
      }
      const hit = isForbiddenSpec(spec);
      if (hit) {
        forbiddenEdges.push({ from: relFile, to: hit.to, detail: hit.code });
        findings.push({
          code: hit.code,
          severity: 'error',
          message: `Forbidden client dependency edge: ${relFile} -> ${hit.to}`,
          path: relFile,
        });
      }
    }

    if (CREDENTIAL_RE.test(text)) {
      forbiddenEdges.push({ from: relFile, to: 'process.env.*CREDENTIAL*', detail: 'client-forbidden-credential' });
      findings.push({
        code: 'client-forbidden-credential',
        severity: 'error',
        message: `Client root reads authority/source credential env: ${relFile}`,
        path: relFile,
      });
    }

    if (ALIAS_HINT_RE.test(text)) {
      forbiddenEdges.push({ from: relFile, to: 'alias-pg', detail: 'client-forbidden-import-alias' });
      findings.push({
        code: 'client-forbidden-import-alias',
        severity: 'error',
        message: `Import alias cannot evade pg/adapter gate: ${relFile}`,
        path: relFile,
      });
    }

    // Dynamic import with computed-looking pg path still caught if literal appears
    if (/import\s*\(\s*['"]pg['"]\s*\)/.test(text) || /require\s*\(\s*['"]pg['"]\s*\)/.test(text)) {
      if (!forbiddenEdges.some((e) => e.from === relFile && e.to === 'pg')) {
        forbiddenEdges.push({ from: relFile, to: 'pg', detail: 'client-forbidden-dynamic-pg' });
        findings.push({
          code: 'client-forbidden-dynamic-pg',
          severity: 'error',
          message: `Dynamic/require pg import forbidden from client root: ${relFile}`,
          path: relFile,
        });
      }
    }
  }

  const status: NoBypassReport['status'] = findings.some((f) => f.severity === 'error') ? 'Rejected' : 'Certified';
  return Object.freeze({
    schemaVersion: NO_BYPASS_SCHEMA_VERSION,
    ticket: 'ZN-0292',
    spec: 'SPEC-050',
    status,
    selectedFileCount: uniqueFiles.length,
    clientRoots: [...CLIENT_ROOTS],
    trustedRoots: [...TRUSTED_ROOTS],
    forbiddenEdges: Object.freeze([...forbiddenEdges]),
    allowedSemanticClientImports: Object.freeze([...allowedSemanticClientImports]),
    findings: Object.freeze([...findings]),
    fixtureSeed,
  });
}

export class NoBypassGraphChecker implements NoBypassGraphPort {
  check(root: string, options?: { fixtureSeed?: string }): NoBypassReport {
    return checkNoBypassGraph(root, options);
  }
}

export function reportDigest(report: NoBypassReport): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        status: report.status,
        selectedFileCount: report.selectedFileCount,
        edges: report.forbiddenEdges,
        findings: report.findings.map((f) => f.code),
      }),
      'utf8',
    )
    .digest('hex');
}
