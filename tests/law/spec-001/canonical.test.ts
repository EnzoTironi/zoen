import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0010-canonical-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/canonical.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/canonical.schema.json');
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0010-kernel-build-${process.pid}`);
  mkdirSync(cfgDir, { recursive: true });
  const cfg = join(cfgDir, 'tsconfig.json');
  writeFileSync(
    cfg,
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2023', 'DOM'],
          types: [],
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          verbatimModuleSyntax: true,
          forceConsistentCasingInFileNames: true,
          rootDir: join(ROOT, 'packages/kernel/src'),
          outDir: KERNEL_OUT,
          declaration: true,
          skipLibCheck: true,
          noEmitOnError: true,
        },
        include: [
          join(ROOT, 'packages/kernel/src/json.ts'),
          join(ROOT, 'packages/kernel/src/result.ts'),
        ],
      },
      null,
      2,
    ),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', env: process.env });
  assert.equal(tsc.status, 0, `kernel emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureKernelEmit();

const {
  JSON_LIMITS,
  canonicalDigest,
  canonicalJson,
  parseEnvelope,
  parseJsonText,
  parseJsonTextSafe,
} = await import('../../../.core-build/packages/kernel/src/json.js');

type Fixture = {
  seed: string;
  objectA: Record<string, unknown>;
  objectB: Record<string, unknown>;
  duplicateKeyJson: string;
  expectedDigest: string;
  envelope: Record<string, unknown>;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function registerZn0010Tests(): void {
  test('ZN-0010-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    const digestA = canonicalDigest(fx.objectA as never);
    const digestB = canonicalDigest(fx.objectB as never);
    assert.equal(digestA, digestB);
    assert.equal(digestA, fx.expectedDigest);
    assert.equal(canonicalJson(fx.objectA as never), canonicalJson(fx.objectB as never));

    const dup = parseJsonTextSafe(fx.duplicateKeyJson);
    assert.equal(dup.tag, 'InvalidInput');
    if (dup.tag !== 'InvalidInput') return;
    assert.equal(dup.code, 'JSON_DUPLICATE_KEY');
    // Must not silently last-write-wins
    assert.throws(() => parseJsonText(fx.duplicateKeyJson));
  });

  test('ZN-0010-NEG', () => {
    const remote = parseJsonTextSafe('{"$ref":"https://evil.example/schema.json"}');
    assert.equal(remote.tag, 'InvalidInput');
    if (remote.tag === 'InvalidInput') assert.equal(remote.code, 'JSON_REMOTE_REFERENCE');

    const fractional = parseJsonTextSafe('{"n":1.5}');
    assert.equal(fractional.tag, 'InvalidInput');

    const badEnvelope = parseEnvelope(new TextEncoder().encode(JSON.stringify({ schemaVersion: 'nope' })));
    assert.equal(badEnvelope.tag, 'InvalidInput');

    const fx = fixture();
    const envBytes = new TextEncoder().encode(JSON.stringify(fx.envelope));
    const okEnv = parseEnvelope(envBytes);
    assert.equal(okEnv.tag, 'Ok');
  });

  test('ZN-0010-BOUNDARY', () => {
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(JSON_LIMITS.bytes, 1_048_576);
    assert.equal(JSON_LIMITS.depth, 32);
    assert.equal(JSON_LIMITS.entries, 10_000);

    assert.equal(parseJsonTextSafe('').tag, 'InvalidInput');

    // depth overflow
    let deep = '"x"';
    for (let i = 0; i < 33; i++) deep = `[${deep}]`;
    const depth = parseJsonTextSafe(deep);
    assert.equal(depth.tag, 'InvalidInput');
    if (depth.tag === 'InvalidInput') assert.equal(depth.code, 'JSON_DEPTH_LIMIT');

    // entry overflow with tight limit
    const many = `{${Array.from({ length: 5 }, (_, i) => `"k${i}":1`).join(',')}}`;
    const entries = parseJsonTextSafe(many, { bytes: 1024, depth: 8, entries: 3 });
    assert.equal(entries.tag, 'InvalidInput');

    // byte overflow
    const big = `"${'a'.repeat(100)}"`;
    const bytes = parseJsonTextSafe(big, { bytes: 16, depth: 4, entries: 100 });
    assert.equal(bytes.tag, 'InvalidInput');

    // reordered keys -> same digest (deterministic)
    const d1 = canonicalDigest({ z: 1, a: 2 } as never);
    const d2 = canonicalDigest({ a: 2, z: 1 } as never);
    assert.equal(d1, d2);
    assert.match(d1, /^[a-f0-9]{64}$/);
  });
}

registerZn0010Tests();
