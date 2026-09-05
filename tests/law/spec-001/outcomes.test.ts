import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0011-outcomes-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/outcomes.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/outcomes.schema.json');
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0011-kernel-build-${process.pid}`);
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
        include: [join(ROOT, 'packages/kernel/src/result.ts')],
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
  OUTCOME_LIMITS,
  decodeOutcomeResult,
  encodeOutcomeResult,
  fail,
  httpStatus,
  interpretationAxes,
  ok,
  outcomeDocument,
  parseInterpretationAxes,
  parsePresence,
  parseResult,
  presenceDeleted,
  presenceFalse,
  presenceMissing,
  presencePresent,
  presenceZero,
  serializeOutcomeDocument,
  serializePresence,
  serializeResult,
} = await import('../../../.core-build/packages/kernel/src/result.js');

type Fixture = {
  seed: string;
  selectedContestedUnverifiedZero: {
    interpretation: { status: string; verification: string; contested: boolean };
    amount: { tag: string; amount?: string };
  };
  distinctPresence: Record<string, Record<string, unknown>>;
  failureSample: { tag: string; code: string };
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function registerZn0011Tests(): void {
  test('ZN-0011-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    const axes = interpretationAxes('selected', 'unverified', true);
    const amount = presenceZero('0');
    const doc = outcomeDocument(axes, amount);
    const encoded = encodeOutcomeResult(ok(doc));
    const decoded = decodeOutcomeResult(encoded);
    assert.equal(decoded.tag, 'Ok');
    if (decoded.tag !== 'Ok') return;

    assert.equal(decoded.value.interpretation.status, 'selected');
    assert.equal(decoded.value.interpretation.verification, 'unverified');
    assert.equal(decoded.value.interpretation.contested, true);
    assert.equal(decoded.value.amount.tag, 'Zero');
    if (decoded.value.amount.tag === 'Zero') {
      assert.equal(decoded.value.amount.amount, '0');
    }
    // Zero never becomes unknown / missing
    assert.notEqual(decoded.value.interpretation.status, 'unknown');
    assert.notEqual(decoded.value.amount.tag, 'Missing');

    // Fixture oracle round-trip
    const fromFixture = decodeOutcomeResult(
      JSON.stringify({ tag: 'Ok', value: fx.selectedContestedUnverifiedZero }),
    );
    assert.equal(fromFixture.tag, 'Ok');
    if (fromFixture.tag === 'Ok') {
      assert.deepEqual(serializeOutcomeDocument(fromFixture.value), fx.selectedContestedUnverifiedZero);
    }

    // Unknown discriminants fail explicitly
    const badTag = parseResult({ tag: 'TotallyMadeUp', code: 'X' });
    assert.equal(badTag.tag, 'InvalidInput');
    if (badTag.tag === 'InvalidInput') assert.equal(badTag.code, 'RESULT_UNKNOWN_DISCRIMINANT');
  });

  test('ZN-0011-NEG', () => {
    const badStatus = parseInterpretationAxes({
      status: 'done',
      verification: 'unverified',
      contested: false,
    });
    assert.equal(badStatus.tag, 'InvalidInput');
    if (badStatus.tag === 'InvalidInput') assert.equal(badStatus.code, 'AXES_STATUS_UNKNOWN');

    const nonZeroAsZero = parsePresence({ tag: 'Zero', amount: '1.00' });
    assert.equal(nonZeroAsZero.tag, 'InvalidInput');
    if (nonZeroAsZero.tag === 'InvalidInput') assert.equal(nonZeroAsZero.code, 'PRESENCE_ZERO_NOT_ZERO');

    const unknownPresence = parsePresence({ tag: 'Maybe' });
    assert.equal(unknownPresence.tag, 'InvalidInput');
    if (unknownPresence.tag === 'InvalidInput') {
      assert.equal(unknownPresence.code, 'PRESENCE_UNKNOWN_DISCRIMINANT');
    }

    const coerced = parseResult({ tag: 'Ok', value: 1, extra: true });
    assert.equal(coerced.tag, 'InvalidInput');

    // Failure sample stays tagged without I/O
    const fx = fixture();
    const failure = parseResult(fx.failureSample);
    assert.equal(failure.tag, 'InvalidInput');
    if (failure.tag === 'InvalidInput') assert.equal(failure.code, 'RESULT_UNKNOWN_DISCRIMINANT');
  });

  test('ZN-0011-BOUNDARY', () => {
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    // Distinct presence kinds survive serialization independently
    const kinds = [
      presenceMissing(),
      presenceZero('0.0'),
      presenceFalse(),
      presenceDeleted(),
      presencePresent('1.00'),
    ];
    const tags = new Set(kinds.map((k) => k.tag));
    assert.equal(tags.size, 5);
    for (const kind of kinds) {
      const round = parsePresence(serializePresence(kind));
      assert.equal(round.tag, 'Ok');
      if (round.tag === 'Ok') assert.equal(round.value.tag, kind.tag);
    }
    assert.deepEqual(serializePresence(presenceMissing()), fx.distinctPresence.missing);
    assert.deepEqual(serializePresence(presenceFalse()), fx.distinctPresence.false);
    assert.deepEqual(serializePresence(presenceDeleted()), fx.distinctPresence.deleted);

    // Empty / overflow
    assert.equal(decodeOutcomeResult('').tag, 'InvalidInput');
    // constructor throws KernelError; parse path returns tagged error
    assert.throws(() => presencePresent('x'.repeat(OUTCOME_LIMITS.maxPresentChars + 1)));
    const presentOverflow = parsePresence({
      tag: 'Present',
      value: 'y'.repeat(OUTCOME_LIMITS.maxPresentChars + 1),
    });
    assert.equal(presentOverflow.tag, 'InvalidInput');

    // Reordered equivalent object keys — deterministic JSON parse of axes
    const reordered = parseInterpretationAxes({
      contested: true,
      verification: 'unverified',
      status: 'selected',
    });
    assert.equal(reordered.tag, 'Ok');
    if (reordered.tag === 'Ok') {
      assert.equal(reordered.value.status, 'selected');
      assert.equal(reordered.value.contested, true);
    }

    // Exhaustive failure tags map to HTTP without truncation
    for (const tag of OUTCOME_LIMITS.failureTags) {
      const status = httpStatus(fail(tag, 'BOUNDARY_CODE'));
      assert.equal(typeof status, 'number');
      assert.ok(status >= 200 && status < 600);
    }
    assert.equal(httpStatus(ok(null)), 200);

    // serializeResult rejects nothing for known Ok; unknown handled at parse
    const wire = serializeResult(ok({ a: 1 }));
    assert.deepEqual(wire, { tag: 'Ok', value: { a: 1 } });
  });
}

registerZn0011Tests();
