import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0008-scalars-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/scalars.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/scalars.schema.json');
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0008-kernel-build-${process.pid}`);
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
          join(ROOT, 'packages/kernel/src/decimal.ts'),
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
  addMoney,
  compareMoney,
  compareQuantities,
  DECIMAL_LIMITS,
  formatDecimal,
  money,
  normalizeDecimal,
  parseDecimal,
  parseMoney,
  quantity,
  releasedConversion,
  tryAddMoney,
} = await import('../../../.core-build/packages/kernel/src/decimal.js');

type Fixture = {
  seed: string;
  brlA: string;
  brlB: string;
  brlSum: string;
  grams: string;
  kilograms: string;
  kgToGFactor: string;
  usd: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function registerZn0008Tests(): void {
  test('ZN-0008-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    const a = money(fx.brlA, 'BRL');
    const b = money(fx.brlB, 'BRL');
    const sum = addMoney(a, b);
    assert.equal(sum.currency, 'BRL');
    assert.equal(formatDecimal(sum.amount), fx.brlSum);

    const grams = quantity(fx.grams, 'g');
    const kilos = quantity(fx.kilograms, 'kg');
    const withoutFactor = compareQuantities(grams, kilos);
    assert.equal(withoutFactor.tag, 'NonComparable');
    if (withoutFactor.tag === 'NonComparable') assert.equal(withoutFactor.code, 'MISSING_CONVERSION');

    const factor = releasedConversion({
      fromUnit: 'kg',
      toUnit: 'g',
      factor: fx.kgToGFactor,
      evidenceId: 'conv.mass.kg-g.v1',
      effectiveFrom: '2026-01-01',
    });
    const withFactor = compareQuantities(kilos, grams, factor);
    assert.equal(withFactor.tag, 'Comparable');
    if (withFactor.tag === 'Comparable') assert.equal(withFactor.order, 0);

    const usd = money(fx.usd, 'USD');
    const mixed = compareMoney(a, usd);
    assert.equal(mixed.tag, 'NonComparable');
    if (mixed.tag === 'NonComparable') assert.equal(mixed.code, 'CURRENCY_MISMATCH');
  });

  test('ZN-0008-NEG', () => {
    const bad = normalizeDecimal('1e2', { scale: 2, rounding: 'reject' });
    assert.equal(bad.tag, 'InvalidInput');
    if (bad.tag !== 'InvalidInput') return;
    assert.equal(bad.code, 'DECIMAL_SYNTAX');

    const locale = normalizeDecimal('1,50', { scale: 2, rounding: 'reject' });
    assert.equal(locale.tag, 'InvalidInput');

    const floatish = parseMoney(0.1 as unknown as string, 'BRL');
    assert.equal(floatish.tag, 'InvalidInput');

    const mismatch = tryAddMoney(money('1.00', 'BRL'), money('1.00', 'USD'));
    assert.equal(mismatch.tag, 'InvalidInput');
    if (mismatch.tag !== 'InvalidInput') return;
    assert.equal(mismatch.code, 'CURRENCY_MISMATCH');

    assert.throws(() => quantity('1', 'lb'));
    assert.throws(() => money('1', 'brl'));
    assert.throws(() =>
      releasedConversion({
        fromUnit: 'kg',
        toUnit: 'g',
        factor: '0',
        evidenceId: 'x',
        effectiveFrom: '2026-01-01',
      }),
    );
  });

  test('ZN-0008-BOUNDARY', () => {
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);
    assert.equal(DECIMAL_LIMITS.precision, 38);
    assert.equal(DECIMAL_LIMITS.maxScale, 18);

    assert.throws(() => parseDecimal(''));
    assert.throws(() => parseDecimal('100000000000000000000'));
    assert.throws(() => parseDecimal('0.0000000000000000001'));

    const max = parseDecimal('99999999999999999999.999999999999999999');
    assert.equal(formatDecimal(max), '99999999999999999999.999999999999999999');

    // reordered equivalent money compare is deterministic
    const left = compareMoney(money('0.10', 'BRL'), money('0.20', 'BRL'));
    const right = compareMoney(money('0.20', 'BRL'), money('0.10', 'BRL'));
    assert.equal(left.tag, 'Comparable');
    assert.equal(right.tag, 'Comparable');
    if (left.tag === 'Comparable' && right.tag === 'Comparable') {
      assert.equal(left.order, -1);
      assert.equal(right.order, 1);
    }

    // rounding required — no silent truncation
    const rounded = normalizeDecimal('2.345', { scale: 2, rounding: 'reject' });
    assert.equal(rounded.tag, 'InvalidInput');
    if (rounded.tag === 'InvalidInput') assert.equal(rounded.code, 'ROUNDING_REQUIRED');

    const halfEven = normalizeDecimal('2.345', { scale: 2, rounding: 'half-even' });
    assert.equal(halfEven.tag, 'Ok');
    if (halfEven.tag === 'Ok') assert.equal(formatDecimal(halfEven.value), '2.34');

    // factor directionality: grams->kg needs matching conversion
    const grams = quantity('1000', 'g');
    const kilos = quantity('1', 'kg');
    const kgToG = releasedConversion({
      fromUnit: 'kg',
      toUnit: 'g',
      factor: '1000',
      evidenceId: 'conv.mass.kg-g.v1',
      effectiveFrom: '2026-01-01',
    });
    assert.equal(compareQuantities(grams, kilos, kgToG).tag, 'Comparable');
  });
}

registerZn0008Tests();
