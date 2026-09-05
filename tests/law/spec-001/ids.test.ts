import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const FIXTURE_SEED = 'zn-0007-ids-seed-v1';
const FIXTURE_PATH = join(ROOT, 'tests/fixtures/spec-001/ids.json');
const SCHEMA_PATH = join(ROOT, 'contracts/spec-001/ids.schema.json');
const REQUIRED_CHECK_IDS = ['ZN-0007-AC', 'ZN-0007-NEG', 'ZN-0007-BOUNDARY'] as const;
const KERNEL_OUT = join(ROOT, '.core-build/packages/kernel/src');

const EVAL_WORLD_ID = '11111111-1111-4111-8111-111111111111';
const LIVE_WORLD_ID = '22222222-2222-4222-8222-222222222222';
const OP_ID = '33333333-3333-4333-8333-333333333333';
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

function ensureKernelEmit(): void {
  mkdirSync(KERNEL_OUT, { recursive: true });
  const cfgDir = join(tmpdir(), `zn-0007-kernel-build-${process.pid}`);
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
          noImplicitOverride: true,
          noFallthroughCasesInSwitch: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          useUnknownInCatchVariables: true,
          verbatimModuleSyntax: true,
          forceConsistentCasingInFileNames: true,
          rootDir: join(ROOT, 'packages/kernel/src'),
          outDir: KERNEL_OUT,
          declaration: true,
          skipLibCheck: true,
          noEmitOnError: true,
        },
        include: [
          join(ROOT, 'packages/kernel/src/ids.ts'),
          join(ROOT, 'packages/kernel/src/result.ts'),
          join(ROOT, 'packages/kernel/src/json.ts'),
        ],
      },
      null,
      2,
    ),
  );
  const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  rmSync(cfgDir, { recursive: true, force: true });
  assert.equal(tsc.status, 0, `kernel emit failed:\n${tsc.stdout}\n${tsc.stderr}`);
  assert.equal(existsSync(join(KERNEL_OUT, 'ids.js')), true);
}

ensureKernelEmit();

const {
  assertWorld,
  counter,
  digest,
  evaluationWorldRef,
  liveOnlyActionInput,
  liveWorldRef,
  nextCounter,
  parseCounter,
  parseDigest,
  parseLiveOnlyActionInput,
  parseLiveWorldRef,
  parseRealm,
  parseRevision,
  parseSemanticId,
  parseUuid,
  parseWorldRef,
  revision,
  sameWorld,
  semanticId,
  uuid,
} = await import('../../../.core-build/packages/kernel/src/ids.js');

type LiveWorldRef = import('../../../.core-build/packages/kernel/src/ids.js').LiveWorldRef;
type LiveOnlyActionInput = import('../../../.core-build/packages/kernel/src/ids.js').LiveOnlyActionInput;
type EvaluationWorldRef = import('../../../.core-build/packages/kernel/src/ids.js').EvaluationWorldRef;

function fixture(): {
  seed: string;
  evaluationWorldRef: { worldId: string; realm: string };
  liveOnlyAction: { worldRef: { worldId: string; realm: string }; operation: string; operationId: string };
  validDigest: string;
  maxCounter: string;
} {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReturnType<typeof fixture>;
}

function registerZn0007Tests(): void {
  test('ZN-0007-AC', () => {
    assert.equal(existsSync(SCHEMA_PATH), true);
    assert.equal(existsSync(FIXTURE_PATH), true);
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    const evalRef = evaluationWorldRef(fx.evaluationWorldRef);
    assert.equal(evalRef.realm, 'evaluation');
    assert.equal(evalRef.worldId, uuid(EVAL_WORLD_ID));

    // Runtime: evaluation WorldRef submitted as live-only Action input => InvalidInput
    // before any repository call (pure parser; no I/O).
    const mixed = parseLiveOnlyActionInput({
      worldRef: { worldId: evalRef.worldId, realm: 'evaluation' },
      operation: 'action.live_only_demo',
      operationId: OP_ID,
    });
    assert.equal(mixed.tag, 'InvalidInput');
    if (mixed.tag === 'Ok') return;
    assert.equal(mixed.code, 'LIVE_REALM_REQUIRED');

    // Same payload with live realm parses.
    const liveOk = parseLiveOnlyActionInput(fx.liveOnlyAction);
    assert.equal(liveOk.tag, 'Ok');
    if (liveOk.tag !== 'Ok') return;
    assert.equal(liveOk.value.worldRef.realm, 'live');

    // Compile-time: @ts-expect-error witnesses inside ids.ts must typecheck.
    const cfgDir = join(tmpdir(), `zn-0007-compile-${process.pid}`);
    mkdirSync(cfgDir, { recursive: true });
    try {
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
              noEmit: true,
              skipLibCheck: true,
              verbatimModuleSyntax: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
            },
            include: [
              join(ROOT, 'packages/kernel/src/ids.ts'),
              join(ROOT, 'packages/kernel/src/result.ts'),
              join(ROOT, 'packages/kernel/src/json.ts'),
            ],
          },
          null,
          2,
        ),
      );
      const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', cfg], {
        cwd: ROOT,
        encoding: 'utf8',
        env: process.env,
      });
      assert.equal(tsc.status, 0, `compile-negative fixtures must typecheck:\n${tsc.stdout}\n${tsc.stderr}`);
    } finally {
      rmSync(cfgDir, { recursive: true, force: true });
    }

    const live: LiveWorldRef = liveWorldRef({ worldId: LIVE_WORLD_ID, realm: 'live' });
    const action: LiveOnlyActionInput = liveOnlyActionInput({
      worldRef: { worldId: live.worldId, realm: 'live' },
      operation: 'action.live_only_demo',
      operationId: OP_ID,
    });
    assert.equal(action.worldRef.realm, 'live');
    void (null as unknown as EvaluationWorldRef);
  });

  test('ZN-0007-NEG', () => {
    const fx = fixture();
    assert.ok(fx.seed.includes('zn-0007'));

    const badUuid = parseUuid('not-a-uuid');
    assert.equal(badUuid.tag, 'InvalidInput');
    if (badUuid.tag !== 'InvalidInput') return;
    assert.equal(badUuid.code, 'INVALID_UUID');

    const badRealm = parseRealm('staging');
    assert.equal(badRealm.tag, 'InvalidInput');
    if (badRealm.tag !== 'InvalidInput') return;
    assert.equal(badRealm.code, 'INVALID_REALM');

    const badType = parseWorldRef('not-an-object');
    assert.equal(badType.tag, 'InvalidInput');

    const liveRequired = parseLiveWorldRef({ worldId: EVAL_WORLD_ID, realm: 'evaluation' });
    assert.equal(liveRequired.tag, 'InvalidInput');
    if (liveRequired.tag !== 'InvalidInput') return;
    assert.equal(liveRequired.code, 'LIVE_REALM_REQUIRED');

    const badDigest = parseDigest('xyz');
    assert.equal(badDigest.tag, 'InvalidInput');
    if (badDigest.tag !== 'InvalidInput') return;
    assert.equal(badDigest.code, 'INVALID_DIGEST');

    const badSem = parseSemanticId('Bad.Case');
    assert.equal(badSem.tag, 'InvalidInput');
    if (badSem.tag !== 'InvalidInput') return;
    assert.equal(badSem.code, 'INVALID_SEMANTIC_ID');

    const badRev = parseRevision('-1');
    assert.equal(badRev.tag, 'InvalidInput');
    if (badRev.tag !== 'InvalidInput') return;
    assert.equal(badRev.code, 'INVALID_REVISION');

    // No coercion: number counter rejected
    const coerced = parseCounter(1 as unknown as string);
    assert.equal(coerced.tag, 'InvalidInput');
  });

  test('ZN-0007-BOUNDARY', () => {
    const fx = fixture();
    assert.equal(fx.seed, FIXTURE_SEED);

    assert.equal(parseUuid('').tag, 'InvalidInput');
    assert.equal(parseSemanticId('').tag, 'InvalidInput');
    assert.equal(parseDigest('').tag, 'InvalidInput');
    assert.equal(parseCounter('0').tag, 'Ok');
    assert.equal(parseCounter(fx.maxCounter).tag, 'Ok');
    assert.equal(parseCounter('9223372036854775808').tag, 'InvalidInput');
    assert.equal(parseRevision('0').tag, 'Ok');
    assert.equal(nextCounter('0'), counter('1'));

    assert.equal(parseDigest(DIGEST_A + 'a').tag, 'InvalidInput');
    assert.equal(parseDigest(DIGEST_A).tag, 'Ok');
    assert.equal(digest(DIGEST_B), DIGEST_B);

    const a = parseWorldRef({ realm: 'live', worldId: LIVE_WORLD_ID });
    const b = parseWorldRef({ worldId: LIVE_WORLD_ID, realm: 'live' });
    assert.equal(a.tag, 'Ok');
    assert.equal(b.tag, 'Ok');
    if (a.tag === 'Ok' && b.tag === 'Ok') {
      assert.equal(sameWorld(a.value, b.value), true);
      assertWorld(a.value, b.value);
    }

    const live = liveWorldRef({ worldId: LIVE_WORLD_ID, realm: 'live' });
    const evalW = evaluationWorldRef({ worldId: LIVE_WORLD_ID, realm: 'evaluation' });
    assert.equal(sameWorld(live, evalW), false);
    assert.throws(() => assertWorld(live, evalW));

    const maxSem = `a${'b'.repeat(127)}`;
    assert.equal(maxSem.length, 128);
    assert.equal(parseSemanticId(maxSem).tag, 'Ok');
    assert.equal(parseSemanticId(maxSem + 'x').tag, 'InvalidInput');

    assert.equal(uuid('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.equal(revision('42'), '42');
    assert.equal(semanticId('action.live_only_demo'), 'action.live_only_demo');

    const raw = readFileSync(FIXTURE_PATH);
    const digestHex = createHash('sha256').update(raw).digest('hex');
    assert.equal(digestHex.length, 64);
    assert.ok(REQUIRED_CHECK_IDS.length === 3);
  });
}

registerZn0007Tests();
