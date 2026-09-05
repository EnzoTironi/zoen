import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0032-families-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-005/families.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-005/families.schema.json');
const OUT = join(ROOT, '.core-build');

function ensureEmit(): void {
  mkdirSync(OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0032-emit-${process.pid}`);
  mkdirSync(cfgDir, { recursive: true });
  const cfg = join(cfgDir, 'tsconfig.json');
  writeFileSync(
    cfg,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2023', 'DOM'],
        types: [],
        strict: true,
        skipLibCheck: true,
        noEmitOnError: true,
        rootDir: join(ROOT, 'packages'),
        outDir: join(OUT, 'packages'),
        declaration: false,
      },
      include: [
        join(ROOT, 'packages/ontology/src/interpretation/families.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/comparability.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/types.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/ports.ts'),
        join(ROOT, 'packages/ontology/src/interpretation/index.ts'),
        join(ROOT, 'packages/contracts/src/ports.ts'),
        join(ROOT, 'packages/contracts/src/semantic.ts'),
        join(ROOT, 'packages/kernel/src/ids.ts'),
        join(ROOT, 'packages/kernel/src/result.ts'),
        join(ROOT, 'packages/kernel/src/json.ts'),
        join(ROOT, 'packages/kernel/src/decimal.ts'),
        join(ROOT, 'packages/kernel/src/time.ts'),
        join(ROOT, 'packages/adapters/src/pg.ts'),
      ],
    }),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(tsc.status, 0, `emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
}

ensureEmit();

type Fixture = {
  seed: string;
  statementId: string;
  originalId: string;
  copyCount: number;
  independentConflictId: string;
};

function fixture(): Fixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

const { computeFamilySupport, evidenceSetDigest } = await import(
  '../../../.core-build/packages/ontology/src/interpretation/families.js'
);

test('ZN-0032-AC', () => {
  assert.equal(existsSync(SCHEMA_PATH), true);
  assert.equal(existsSync(FIXTURE_PATH), true);
  const fx = fixture();
  assert.equal(fx.seed, FIXTURE_SEED);
  assert.equal(fx.copyCount, 10);

  const evidence = [
    Object.freeze({ evidenceId: fx.originalId, parentEvidenceId: null, kind: 'original' as const }),
    ...Array.from({ length: fx.copyCount }, (_, i) =>
      Object.freeze({
        evidenceId: `ev-copy-${i + 1}`,
        parentEvidenceId: fx.originalId,
        kind: 'copy' as const,
      }),
    ),
    Object.freeze({
      evidenceId: fx.independentConflictId,
      parentEvidenceId: null,
      kind: 'original' as const,
    }),
  ];

  const result = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze(evidence),
  });
  assert.equal(result.tag, 'Ok');
  if (result.tag !== 'Ok') return;

  assert.equal(result.independentSupportCount, 2);
  assert.equal(result.families.length, 2);
  const copyFamily = result.families.find((f: { rootEvidenceId: string }) => f.rootEvidenceId === fx.originalId);
  assert.ok(copyFamily);
  assert.equal(copyFamily!.independentSupport, 1);
  assert.equal(copyFamily!.memberEvidenceIds.length, 11);
  assert.equal(result.attributableEvidenceIds.length, 12);
  assert.ok(result.attributableEvidenceIds.includes(fx.originalId));
  assert.ok(result.attributableEvidenceIds.includes(fx.independentConflictId));
  for (let i = 1; i <= 10; i++) {
    assert.ok(result.attributableEvidenceIds.includes(`ev-copy-${i}`));
  }
  assert.equal(
    result.attributableEvidenceIds.filter((id: string) => id === fx.originalId || id.startsWith('ev-copy-')).length,
    11,
  );
});

test('ZN-0032-NEG', () => {
  const fx = fixture();

  const badKind = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze([
      Object.freeze({ evidenceId: 'e1', parentEvidenceId: null, kind: 'telepathy' as never }),
    ]),
  });
  assert.equal(badKind.tag, 'InvalidInput');
  if (badKind.tag === 'InvalidInput') assert.equal(badKind.code, 'INVALID_KIND');

  const cycle = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze([
      Object.freeze({ evidenceId: 'a', parentEvidenceId: 'b', kind: 'derived' as const }),
      Object.freeze({ evidenceId: 'b', parentEvidenceId: 'a', kind: 'derived' as const }),
    ]),
  });
  assert.equal(cycle.tag, 'InvalidInput');
  if (cycle.tag === 'InvalidInput') assert.equal(cycle.code, 'DERIVATION_CYCLE');

  const unknownParent = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze([
      Object.freeze({ evidenceId: 'child', parentEvidenceId: 'missing', kind: 'copy' as const }),
    ]),
  });
  assert.equal(unknownParent.tag, 'InvalidInput');
  if (unknownParent.tag === 'InvalidInput') assert.equal(unknownParent.code, 'UNKNOWN_PARENT');

  const selfParent = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze([
      Object.freeze({ evidenceId: 'loop', parentEvidenceId: 'loop', kind: 'derived' as const }),
    ]),
  });
  assert.equal(selfParent.tag, 'InvalidInput');
  if (selfParent.tag === 'InvalidInput') assert.equal(selfParent.code, 'SELF_PARENT');
});

test('ZN-0032-BOUNDARY', () => {
  const fx = fixture();

  const empty = computeFamilySupport({ statementId: fx.statementId, evidence: Object.freeze([]) });
  assert.equal(empty.tag, 'InvalidInput');
  if (empty.tag === 'InvalidInput') assert.equal(empty.code, 'EMPTY_EVIDENCE');

  const base = [
    Object.freeze({ evidenceId: fx.originalId, parentEvidenceId: null, kind: 'original' as const }),
    Object.freeze({ evidenceId: 'ev-copy-1', parentEvidenceId: fx.originalId, kind: 'copy' as const }),
    Object.freeze({
      evidenceId: fx.independentConflictId,
      parentEvidenceId: null,
      kind: 'original' as const,
    }),
  ];
  const orderA = computeFamilySupport({ statementId: fx.statementId, evidence: Object.freeze(base) });
  const orderB = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze([...base].reverse()),
  });
  assert.equal(orderA.tag, 'Ok');
  assert.equal(orderB.tag, 'Ok');
  if (orderA.tag !== 'Ok' || orderB.tag !== 'Ok') return;
  assert.equal(orderA.resultDigest, orderB.resultDigest);
  assert.equal(orderA.independentSupportCount, orderB.independentSupportCount);
  assert.deepEqual([...orderA.attributableEvidenceIds], [...orderB.attributableEvidenceIds]);
  assert.equal(evidenceSetDigest(base), evidenceSetDigest([...base].reverse()));

  const tooMany = computeFamilySupport({
    statementId: fx.statementId,
    evidence: Object.freeze(
      Array.from({ length: 10_001 }, (_, i) =>
        Object.freeze({
          evidenceId: `e-${i}`,
          parentEvidenceId: null,
          kind: 'original' as const,
        }),
      ),
    ),
  });
  assert.equal(tooMany.tag, 'InvalidInput');
  if (tooMany.tag === 'InvalidInput') assert.equal(tooMany.code, 'EVIDENCE_LIMIT');
});
