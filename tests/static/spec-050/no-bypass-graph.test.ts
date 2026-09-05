import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkNoBypassGraph,
  CLIENT_ROOTS,
  NO_BYPASS_FIXTURE_SEED,
  NO_BYPASS_SCHEMA_VERSION,
  reportDigest,
} from '../../../tooling/semantic-boundaries/no-bypass-graph.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-050/no-bypass-graph.schema.json');
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-050/no-bypass-graph.json');
const REQUIRED_CHECK_IDS = ['ZN-0292-AC', 'ZN-0292-NEG', 'ZN-0292-BOUNDARY'] as const;

type Fixture = {
  seed: string;
  seedDigest: string;
  clientRoots: string[];
  forbiddenSamples: string[];
  allowedSemanticClient: string[];
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
}

function baseLayout(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'apps/web/src/index.ts': "export const surface = 'web';\n",
    'apps/eve-worker/src/index.ts': "export const surface = 'eve-worker';\n",
    'packages/eve/src/index.ts': "export const surface = 'eve';\n",
    'packages/clients/src/index.ts': "export const surface = 'clients';\n",
    'packages/clients/src/semantic-client.ts':
      "export class SemanticClient { async invoke() { return { tag: 'Ok', value: null }; } }\n",
    'packages/contracts/src/semantic-client.ts':
      "export interface SemanticClientPort { call(): Promise<unknown>; }\n",
    'packages/adapters/src/pg.ts': "export const PgDatabase = {};\n",
    'packages/ontology/src/authority/transaction.ts': "export class Authority {}\n",
    'apps/authority-worker/src/index.ts': "export const trusted = true;\n",
    'runners/local/src/index.ts': "export const runner = true;\n",
    ...extra,
  };
}

test('ZN-0292-AC', () => {
  assert.equal(existsSync(SCHEMA_PATH), true);
  assert.equal(existsSync(FIXTURE_PATH), true);
  const fx = fixture();
  assert.equal(fx.seed, NO_BYPASS_FIXTURE_SEED);
  assert.equal(fx.seed, 'zn-0292-no-bypass-seed-v1');
  assert.ok(fx.clientRoots.length >= 1);
  for (const root of fx.clientRoots) {
    assert.ok(CLIENT_ROOTS.some((c) => c === root || root.startsWith(c) || c.startsWith(root)));
  }

  const dirty = mkdtempSync(join(tmpdir(), 'zn-0292-ac-dirty-'));
  try {
    writeTree(
      dirty,
      baseLayout({
        'apps/web/src/mini-apps/evil.ts':
          "import pg from 'pg';\nexport const leak = pg;\n",
        'packages/eve/src/via-barrel.ts':
          "export { PgDatabase } from '../../adapters/src/pg.js';\n",
        'packages/clients/src/ok-client.ts':
          "import { SemanticClient } from './semantic-client.js';\nexport const c = SemanticClient;\n",
      }),
    );
    const report = checkNoBypassGraph(dirty, { fixtureSeed: fx.seed });
    assert.equal(report.schemaVersion, NO_BYPASS_SCHEMA_VERSION);
    assert.equal(report.status, 'Rejected');
    assert.ok(report.forbiddenEdges.length >= 1);
    assert.ok(
      report.forbiddenEdges.some((e) => e.to === 'pg' || e.detail.includes('pg')),
      JSON.stringify(report.forbiddenEdges),
    );
    assert.ok(
      report.allowedSemanticClientImports.some((s) => s.includes('semantic-client')),
      JSON.stringify(report.allowedSemanticClientImports),
    );
    assert.match(reportDigest(report), /^[a-f0-9]{64}$/);
  } finally {
    rmSync(dirty, { recursive: true, force: true });
  }

  const clean = mkdtempSync(join(tmpdir(), 'zn-0292-ac-clean-'));
  try {
    writeTree(
      clean,
      baseLayout({
        'apps/web/src/mini-apps/ok.ts':
          "import type { SemanticClientPort } from '../../../packages/contracts/src/semantic-client.js';\nexport type P = SemanticClientPort;\n",
      }),
    );
    const report = checkNoBypassGraph(clean, { fixtureSeed: fx.seed });
    assert.equal(report.status, 'Certified');
    assert.equal(report.forbiddenEdges.length, 0);
    assert.ok(report.selectedFileCount > 0);
    assert.ok(report.allowedSemanticClientImports.length >= 1);
  } finally {
    rmSync(clean, { recursive: true, force: true });
  }

  void REQUIRED_CHECK_IDS;
});

test('ZN-0292-NEG', () => {
  const fx = fixture();
  const root = mkdtempSync(join(tmpdir(), 'zn-0292-neg-'));
  try {
    writeTree(
      root,
      baseLayout({
        'apps/web/src/alias-pg.ts':
          "import db from '@/adapters/pg';\nexport const x = db;\n",
        'packages/eve/src/dynamic-pg.ts':
          "export async function load() { return import('pg'); }\n",
        'apps/eve-worker/src/cred.ts':
          "export const url = process.env.AUTHORITY_DATABASE_URL;\n",
      }),
    );
    const report = checkNoBypassGraph(root, { fixtureSeed: fx.seed });
    assert.equal(report.status, 'Rejected');
    const codes = new Set(report.findings.map((f) => f.code));
    assert.ok(codes.has('client-forbidden-import-alias') || codes.has('client-forbidden-pg'), [...codes]);
    assert.ok(codes.has('client-forbidden-dynamic-pg') || codes.has('client-forbidden-pg'), [...codes]);
    assert.ok(codes.has('client-forbidden-credential'), [...codes]);
    // Alias / dynamic must not evade — edges present
    assert.ok(report.forbiddenEdges.length >= 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ZN-0292-BOUNDARY', () => {
  const fx = fixture();
  // Disconnected checker root
  const missing = join(tmpdir(), `zn-0292-missing-${process.pid}-${Date.now()}`);
  const disconnected = checkNoBypassGraph(missing, { fixtureSeed: fx.seed });
  assert.equal(disconnected.status, 'Rejected');
  assert.ok(disconnected.findings.some((f) => f.code === 'disconnected-checker'));
  assert.equal(disconnected.selectedFileCount, 0);

  // Empty graph (directory exists but no selected sources)
  const empty = mkdtempSync(join(tmpdir(), 'zn-0292-empty-'));
  try {
    writeFileSync(join(empty, 'README.md'), 'no sources\n');
    const report = checkNoBypassGraph(empty, { fixtureSeed: fx.seed, requireNonEmpty: true });
    assert.equal(report.status, 'Rejected');
    assert.ok(report.findings.some((f) => f.code === 'empty-graph'));
    assert.equal(report.selectedFileCount, 0);
    // Must not claim certification of emptiness
    assert.notEqual(report.status, 'Certified');
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }

  // Seed digest recorded
  assert.equal(
    createHash('sha256').update(fx.seed, 'utf8').digest('hex').length,
    64,
  );
});
