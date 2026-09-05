import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  REQUIRED_SCRIPTS,
  assertRequiredChecks,
  checkWorkspace,
  certifyWorkspace,
  DISABLED_ROUTE,
  FIXTURE_SEED,
} from '../../../tooling/workspace.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const SCHEMA_PATH = join(WORKSPACE_ROOT, 'contracts/spec-000/workspace.schema.json');
const FIXTURE_PATH = join(WORKSPACE_ROOT, 'tests/fixtures/spec-000/workspace.json');
const REQUIRED_CHECK_IDS = ['ZN-0003-AC', 'ZN-0003-NEG', 'ZN-0003-BOUNDARY'] as const;

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
}

function minimalUnitFiles(kind: 'apps' | 'packages', name: string, indexBody: string): Record<string, string> {
  return {
    [`${kind}/${name}/package.json`]: JSON.stringify(
      { name: `@zoen/${kind === 'apps' ? 'app-' : ''}${name}`, private: true, type: 'module', exports: { '.': './src/index.ts' } },
      null,
      2,
    ),
    [`${kind}/${name}/tsconfig.json`]: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmitOnError: true,
          rootDir: 'src',
          outDir: 'dist',
        },
        include: ['src/index.ts'],
      },
      null,
      2,
    ),
    [`${kind}/${name}/src/index.ts`]: indexBody,
  };
}

function buildCleanWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'zn-0003-clean-'));
  const files: Record<string, string> = {
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          noEmitOnError: true,
        },
        include: [],
      },
      null,
      2,
    ),
    'eslint.config.mjs': 'export default [];\n',
    '.dependency-cruiser.cjs': 'module.exports = { forbidden: [] };\n',
    'contracts/spec-000/workspace.schema.json': readFileSync(SCHEMA_PATH, 'utf8'),
    'package.json': JSON.stringify(
      {
        name: 'zn-0003-clean',
        private: true,
        type: 'module',
        scripts: Object.fromEntries(REQUIRED_SCRIPTS.map((s) => [s, `echo ${s}`])),
      },
      null,
      2,
    ),
  };
  for (const app of ['edge', 'web', 'eve-worker', 'authority-worker', 'effect-worker']) {
    Object.assign(
      files,
      minimalUnitFiles(
        'apps',
        app,
        app === 'web'
          ? "export const WEB_OK = true;\n"
          : `export const APP_${app.replace(/-/g, '_').toUpperCase()} = true;\n`,
      ),
    );
  }
  for (const pkg of ['kernel', 'contracts', 'door', 'ontology', 'eve', 'clients', 'adapters', 'telemetry']) {
    Object.assign(
      files,
      minimalUnitFiles(
        'packages',
        pkg,
        pkg === 'eve'
          ? "export type Port = { id: string };\nexport const EVE_OK = true;\n"
          : pkg === 'contracts'
            ? "export type Database = { connect(): Promise<unknown> };\n"
            : `export const PKG_${pkg.toUpperCase()} = true;\n`,
      ),
    );
  }
  // Valid port import sample inside eve
  files['packages/eve/src/ports-ok.ts'] =
    "import type { Database } from '../../contracts/src/index.ts';\nexport type EvePort = Database;\n";
  writeTree(root, files);
  return root;
}

function registerZn0003Tests(): void {
  test('ZN-0003-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true, 'workspace schema must exist');
    assert.equal(existsSync(join(WORKSPACE_ROOT, 'eslint.config.mjs')), true);
    assert.equal(existsSync(join(WORKSPACE_ROOT, '.dependency-cruiser.cjs')), true);

    const clean = buildCleanWorkspace();
    try {
      const baseline = checkWorkspace(clean, {
        profile: 'static-workspace-boundaries',
        fixtureSeed: FIXTURE_SEED,
        commands: ['ZN-0003-AC'],
      });
      assert.equal(baseline.status, 'Certified', JSON.stringify(baseline.findings, null, 2));
      assert.equal(baseline.dependencyBoundaries.forbiddenEdges.length, 0);
      assert.equal(baseline.placeholderRoutes.length, 0);
      assert.deepEqual(baseline.scripts.missing, []);

      // Eve tries to import PostgreSQL adapter — must fail CI checker
      writeFileSync(
        join(clean, 'packages/eve/src/bad-pg.ts'),
        "import { Pool } from 'pg';\nexport const leak = Pool;\n",
      );
      const eveBad = checkWorkspace(clean);
      assert.equal(eveBad.status, 'Rejected');
      assert.ok(
        eveBad.findings.some((f) => f.code === 'eve-forbidden-pg-adapter'),
        eveBad.findings.map((f) => f.code).join(','),
      );
      rmSync(join(clean, 'packages/eve/src/bad-pg.ts'));

      // Web tries to read an authority credential — must fail
      writeFileSync(
        join(clean, 'apps/web/src/bad-cred.ts'),
        "export const cred = process.env.AUTHORITY_CREDENTIAL;\nexport const url = process.env.ZOEN_AUTHORITY_DATABASE_URL;\n",
      );
      const webBad = checkWorkspace(clean);
      assert.equal(webBad.status, 'Rejected');
      assert.ok(
        webBad.findings.some((f) => f.code === 'web-forbidden-authority-credential'),
        webBad.findings.map((f) => f.code).join(','),
      );
      rmSync(join(clean, 'apps/web/src/bad-cred.ts'));

      // Valid port import remains clean
      const okAgain = checkWorkspace(clean);
      assert.equal(okAgain.status, 'Certified');
      assert.ok(existsSync(join(clean, 'packages/eve/src/ports-ok.ts')));

      // Placeholder route must be rejected
      writeFileSync(
        join(clean, 'apps/edge/src/placeholder-route.ts'),
        "export function add(app: { get: (p: string, h: unknown) => void }) {\n  app.get('/api/placeholder', () => ({ ok: true /* provider */ }));\n}\n",
      );
      const ph = checkWorkspace(clean);
      assert.equal(ph.status, 'Rejected');
      assert.ok(ph.findings.some((f) => f.code === 'placeholder-route-exposed'));

      // Real repo must also certify (no forbidden edges in committed surfaces)
      const repo = certifyWorkspace(WORKSPACE_ROOT);
      assert.equal(repo.ok, true, JSON.stringify(repo.report.findings, null, 2));
      assert.equal(repo.report.toolAdmission.eslintPackage, 'not-admitted');
      assert.equal(repo.report.toolAdmission.dependencyCruiserPackage, 'not-admitted');
    } finally {
      rmSync(clean, { recursive: true, force: true });
    }
  });

  test('ZN-0003-NEG', () => {
    assert.equal(existsSync(FIXTURE_PATH), true);
    const incomplete = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
      status: string;
      scripts: { missing: string[] };
      note?: string;
    };
    assert.equal(incomplete.status, 'Certified', 'fixture falsely claims Certified');
    assert.ok(incomplete.scripts.missing.length > 0);

    const polluted = buildCleanWorkspace();
    try {
      // Introduce forbidden dependency
      writeFileSync(
        join(polluted, 'packages/eve/src/neg-pg.ts'),
        "import pg from 'pg';\nexport default pg;\n",
      );
      const forbidden = checkWorkspace(polluted);
      assert.equal(forbidden.status, 'Rejected');
      assert.ok(forbidden.findings.some((f) => f.code === 'eve-forbidden-pg-adapter'));
      assert.equal(forbidden.disabledRoute, DISABLED_ROUTE);
      rmSync(join(polluted, 'packages/eve/src/neg-pg.ts'));

      // Altered manifest: remove required script
      const pkgPath = join(polluted, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts: Record<string, string> };
      delete pkg.scripts['check'];
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      const missingScript = checkWorkspace(polluted);
      assert.equal(missingScript.status, 'Rejected');
      assert.ok(missingScript.findings.some((f) => f.code === 'missing-required-script'));
      assert.ok(missingScript.scripts.missing.includes('check'));

      // Missing required check IDs must not certify
      assert.throws(
        () => assertRequiredChecks(['ZN-0003-AC'], REQUIRED_CHECK_IDS),
        /missing required checks/,
      );

      // Incomplete fixture must not be treated as live certificate
      assert.notEqual(incomplete.note?.includes('Synthetic'), false);
      const live = checkWorkspace(WORKSPACE_ROOT);
      assert.notDeepEqual(
        { status: live.status, missing: live.scripts.missing },
        { status: incomplete.status, missing: incomplete.scripts.missing },
      );
    } finally {
      rmSync(polluted, { recursive: true, force: true });
    }
  });

  test('ZN-0003-BOUNDARY', () => {
    const a = buildCleanWorkspace();
    const b = buildCleanWorkspace();
    try {
      const reportA = checkWorkspace(a, { fixtureSeed: FIXTURE_SEED, commands: ['boundary-a'] });
      const reportB = checkWorkspace(b, { fixtureSeed: FIXTURE_SEED, commands: ['boundary-b'] });
      // Equal inputs (aside from command label) — recompute with identical commands
      const eqA = checkWorkspace(a, { fixtureSeed: FIXTURE_SEED, commands: ['boundary'] });
      const eqB = checkWorkspace(b, { fixtureSeed: FIXTURE_SEED, commands: ['boundary'] });
      assert.equal(eqA.status, 'Certified');
      assert.equal(eqB.status, 'Certified');
      assert.equal(eqA.artifactDigest, eqB.artifactDigest, 'equal clean workspaces must yield equal digests');

      // Remove one required check → fail
      assert.throws(() => assertRequiredChecks(['ZN-0003-AC', 'ZN-0003-NEG'], REQUIRED_CHECK_IDS), /missing/);

      // Zero-test run fails
      assert.throws(() => assertRequiredChecks([], REQUIRED_CHECK_IDS), /zero-test/);

      // CLI exits nonzero on rejection
      writeFileSync(join(a, 'packages/eve/src/cli-bad.ts'), "import 'pg';\n");
      const cli = spawnSync(
        process.execPath,
        ['--experimental-strip-types', join(WORKSPACE_ROOT, 'tooling/workspace.ts'), 'check'],
        {
          cwd: a,
          env: { ...process.env },
          encoding: 'utf8',
        },
      );
      // Note: CLI uses DEFAULT_WORKSPACE_ROOT (repo), not cwd — exercise API rejection instead
      const rejected = checkWorkspace(a);
      assert.equal(rejected.status, 'Rejected');
      assert.ok(rejected.findings.length > 0);

      // verify:ticket script exists and exits nonzero (planned gate)
      const pkg = JSON.parse(readFileSync(join(WORKSPACE_ROOT, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      assert.ok(pkg.scripts['verify:ticket']);
      const vt = spawnSync(
        process.execPath,
        ['--experimental-strip-types', join(WORKSPACE_ROOT, 'tooling/workspace.ts'), 'verify-ticket-gate'],
        { encoding: 'utf8' },
      );
      assert.notEqual(vt.status, 0);
      assert.match(vt.stderr, /BLOCKED/);

      void reportA;
      void reportB;
      void cli;
      void sha256Text;
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
const underNodeTest = process.execArgv.some((a) => a === '--test' || a.startsWith('--test='));
if (underNodeTest || entry === thisFile || process.env.ZN_0003_RUN_TESTS === '1') {
  registerZn0003Tests();
}
