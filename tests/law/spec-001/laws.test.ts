import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0012-laws-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/laws.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/laws.schema.json');
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0012-kernel-build-${process.pid}`);
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
          join(ROOT, 'packages/kernel/src/laws.ts'),
          join(ROOT, 'packages/kernel/src/decimal.ts'),
          join(ROOT, 'packages/kernel/src/json.ts'),
          join(ROOT, 'packages/kernel/src/time.ts'),
          join(ROOT, 'packages/kernel/src/result.ts'),
          join(ROOT, 'packages/kernel/src/ids.ts'),
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
  LAW_DEFAULTS,
  LAW_NAMES,
  checkParserRejectsOversized,
  lawSuiteDigestsAgree,
  normalizeDecimal,
  parseJsonTextSafe,
  parseMoney,
  runLawSuite,
} = await import('../../../.core-build/packages/kernel/src/index.js').catch(async () => {
  // Prefer direct modules if index pulls graph with comment-only files
  const laws = await import('../../../.core-build/packages/kernel/src/laws.js');
  const decimal = await import('../../../.core-build/packages/kernel/src/decimal.js');
  const json = await import('../../../.core-build/packages/kernel/src/json.js');
  return { ...laws, ...decimal, ...json };
});

type Fixture = {
  seed: string;
  casesPerLaw: number;
  locales: string[];
  timezones: string[];
  invalidScalar: string;
  oversizedProbeLimit: number;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function registerZn0012Tests(): void {
  test('ZN-0012-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(fx.casesPerLaw, LAW_DEFAULTS.casesPerLaw);

    const runA = runLawSuite({
      seed: fx.seed,
      casesPerLaw: fx.casesPerLaw,
      locale: fx.locales[0],
      timezone: fx.timezones[0],
    });
    assert.equal(runA.tag, 'Ok');
    if (runA.tag !== 'Ok') return;
    assert.equal(runA.value.failed, 0, JSON.stringify(runA.value.counterexamples.slice(0, 3)));
    assert.ok(runA.value.executed >= fx.casesPerLaw * LAW_NAMES.length);
    for (const name of LAW_NAMES) {
      assert.ok(runA.value.perLaw[name] >= fx.casesPerLaw, name);
    }
    assert.match(runA.value.digest, /^[a-f0-9]{64}$/);

    const runB = runLawSuite({
      seed: fx.seed,
      casesPerLaw: fx.casesPerLaw,
      locale: fx.locales[1],
      timezone: fx.timezones[1],
    });
    assert.equal(runB.tag, 'Ok');
    if (runB.tag !== 'Ok') return;
    assert.equal(true, lawSuiteDigestsAgree(runA.value, runB.value));
    // Digests of the algebraic outcomes agree even when locale/TZ labels differ
    assert.equal(runA.value.executed, runB.value.executed);
    assert.equal(runA.value.passed, runB.value.passed);

    // Adversarial oversized witness
    assert.equal(checkParserRejectsOversized(fx.oversizedProbeLimit, `"${'z'.repeat(64)}"`), true);
  });

  test('ZN-0012-NEG', () => {
    const fx = fixture();
    const bad = normalizeDecimal(fx.invalidScalar, { scale: 2, rounding: 'reject' });
    assert.equal(bad.tag, 'InvalidInput');

    const money = parseMoney(1.23, 'BRL');
    assert.equal(money.tag, 'InvalidInput');

    const remote = parseJsonTextSafe('{"$ref":"https://evil.example/x"}');
    assert.equal(remote.tag, 'InvalidInput');

    const suite = runLawSuite({ seed: fx.seed, casesPerLaw: 0 });
    assert.equal(suite.tag, 'InvalidInput');
  });

  test('ZN-0012-BOUNDARY', () => {
    const fx = fixture();
    // Empty / minimum
    const emptyJson = parseJsonTextSafe('');
    assert.equal(emptyJson.tag, 'InvalidInput');

    const one = runLawSuite({ seed: fx.seed, casesPerLaw: 1 });
    assert.equal(one.tag, 'Ok');
    if (one.tag === 'Ok') {
      assert.equal(one.value.failed, 0);
      assert.ok(one.value.executed >= LAW_NAMES.length);
    }

    // Overflow casesPerLaw
    const tooMany = runLawSuite({ seed: fx.seed, casesPerLaw: 1_000_001 });
    assert.equal(tooMany.tag, 'InvalidInput');

    // Depth overflow — explicit error, not truncation
    let deep = '0';
    for (let i = 0; i < 40; i++) deep = `[${deep}]`;
    const depth = parseJsonTextSafe(deep);
    assert.equal(depth.tag, 'InvalidInput');

    // Reordered equivalent objects — digest law already covers; spot-check
    const spot = runLawSuite({ seed: 'zn-0012-boundary-spot', casesPerLaw: 100 });
    assert.equal(spot.tag, 'Ok');
    if (spot.tag === 'Ok') assert.equal(spot.value.failed, 0);
  });
}

registerZn0012Tests();
