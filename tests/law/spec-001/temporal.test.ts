import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0009-temporal-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/temporal.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/temporal.schema.json');
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0009-kernel-build-${process.pid}`);
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
          join(ROOT, 'packages/kernel/src/time.ts'),
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
  clockSample,
  commitCut,
  compareIntervals,
  contains,
  instant,
  intersectIntervals,
  interval,
  localDate,
  overlaps,
  parseInstant,
  parseLocalDate,
  parseZonedAppointment,
  unknownInterval,
  validTime,
  wallTime,
} = await import('../../../.core-build/packages/kernel/src/time.js');

type Fixture = {
  seed: string;
  adjacentA: { from: string; until: string };
  adjacentB: { from: string; until: string };
  dstOverlap: {
    zoneId: string;
    date: string;
    hour: number;
    minute: number;
    offsetsMinutes: number[];
    earlierInstant: string;
    laterInstant: string;
  };
  dstGap: {
    zoneId: string;
    date: string;
    hour: number;
    minute: number;
    offsetsMinutes: number[];
  };
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

function registerZn0009Tests(): void {
  test('ZN-0009-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    const a = interval(instant(fx.adjacentA.from), instant(fx.adjacentA.until));
    const b = interval(instant(fx.adjacentB.from), instant(fx.adjacentB.until));
    assert.equal(overlaps(a, b), false);
    const inter = intersectIntervals(a, b);
    assert.equal(inter.tag, 'Empty');

    // Daylight-saving overlap: ambiguous without choice
    const wall = wallTime(fx.dstOverlap.date, fx.dstOverlap.hour, fx.dstOverlap.minute);
    const lookup = {
      zoneId: fx.dstOverlap.zoneId,
      wall,
      offsetsMinutes: fx.dstOverlap.offsetsMinutes,
    };
    const rejected = parseZonedAppointment({ lookup, disambiguation: 'reject' });
    assert.equal(rejected.tag, 'InvalidInput');
    if (rejected.tag !== 'InvalidInput') return;
    assert.equal(rejected.code, 'AMBIGUOUS_LOCAL_TIME');

    const earlier = parseZonedAppointment({ lookup, disambiguation: 'earlier' });
    assert.equal(earlier.tag, 'Ok');
    if (earlier.tag === 'Ok') {
      assert.equal(earlier.value.instant.iso, fx.dstOverlap.earlierInstant);
    }
    const later = parseZonedAppointment({ lookup, disambiguation: 'later' });
    assert.equal(later.tag, 'Ok');
    if (later.tag === 'Ok') {
      assert.equal(later.value.instant.iso, fx.dstOverlap.laterInstant);
    }

    // Host timezone must not affect UTC Instant parsing
    const before = instant('2026-01-01T00:00:00.000000000Z');
    process.env.TZ = 'Pacific/Kiritimati';
    const after = instant('2026-01-01T00:00:00.000000000Z');
    process.env.TZ = 'UTC';
    assert.equal(before.iso, after.iso);
    assert.equal(before.nanoseconds, after.nanoseconds);
  });

  test('ZN-0009-NEG', () => {
    assert.equal(parseInstant('2026-01-01T00:00:00').tag, 'InvalidInput');
    assert.equal(parseInstant(1 as unknown as string).tag, 'InvalidInput');
    assert.equal(parseLocalDate('2026-13-01').tag, 'InvalidInput');
    assert.equal(parseLocalDate('2026-02-30').tag, 'InvalidInput');

    const gapWall = wallTime(fixture().dstGap.date, fixture().dstGap.hour, fixture().dstGap.minute);
    const gap = parseZonedAppointment({
      lookup: {
        zoneId: fixture().dstGap.zoneId,
        wall: gapWall,
        offsetsMinutes: fixture().dstGap.offsetsMinutes,
      },
    });
    assert.equal(gap.tag, 'InvalidInput');
    if (gap.tag === 'InvalidInput') assert.equal(gap.code, 'NONEXISTENT_LOCAL_TIME');

    assert.throws(() => interval(instant('2026-01-02T00:00:00.000000000Z'), instant('2026-01-01T00:00:00.000000000Z')));
    const mixed = compareIntervals(
      interval(localDate('2026-01-01'), localDate('2026-01-02')),
      interval(instant('2026-01-01T00:00:00.000000000Z'), instant('2026-01-02T00:00:00.000000000Z')),
    );
    assert.equal(mixed.tag, 'NonComparable');
  });

  test('ZN-0009-BOUNDARY', () => {
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    assert.equal(parseInstant('').tag, 'InvalidInput');
    assert.equal(parseLocalDate('0000-01-01').tag, 'InvalidInput');
    const max = parseLocalDate('9999-12-31');
    assert.equal(max.tag, 'Ok');

    // half-open: endpoint excluded
    const win = interval(instant('2026-01-01T00:00:00.000000000Z'), instant('2026-01-01T01:00:00.000000000Z'));
    assert.equal(contains(win, instant('2026-01-01T00:00:00.000000000Z')), true);
    assert.equal(contains(win, instant('2026-01-01T01:00:00.000000000Z')), false);

    // unknown valid time is not a commit cut and does not contain
    const unknown = unknownInterval();
    assert.equal(contains(unknown, instant('2026-01-01T00:00:00.000000000Z')), false);
    const vt = validTime(win);
    const cut = commitCut(instant('2026-01-01T12:00:00.000000000Z'));
    assert.equal(vt.kind, 'ValidTime');
    assert.equal(cut.kind, 'CommitCut');
    assert.notEqual(vt.kind, cut.kind);

    const sample = clockSample(instant('2026-01-01T00:30:00.000000000Z'), 'test.clock');
    assert.equal(contains(win, sample.at), true);

    // reordered equivalent compareIntervals is deterministic
    const left = interval(instant('2026-01-01T00:00:00.000000000Z'), instant('2026-01-02T00:00:00.000000000Z'));
    const right = interval(instant('2026-01-01T00:00:00.000000000Z'), instant('2026-01-03T00:00:00.000000000Z'));
    const c1 = compareIntervals(left, right);
    const c2 = compareIntervals(right, left);
    assert.equal(c1.tag, 'Comparable');
    assert.equal(c2.tag, 'Comparable');
    if (c1.tag === 'Comparable' && c2.tag === 'Comparable') {
      assert.equal(c1.order, -1);
      assert.equal(c2.order, 1);
    }
  });
}

registerZn0009Tests();
