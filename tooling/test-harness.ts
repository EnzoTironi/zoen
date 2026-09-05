/**
 * ZN-0004 — real dependency test harness with clocks and barriers.
 * Never skips required work; missing services => MissingPrerequisite.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, '..');
export const SCHEMA_VERSION = 'spec-000.test-harness.v1';
export const FIXTURE_SEED = 'zn-0004-harness-seed-v1';
export const DISABLED_ROUTE = 'test-harness-implementation-and-merge';
export const REQUIRED_CHECK_IDS = ['ZN-0004-AC', 'ZN-0004-NEG', 'ZN-0004-BOUNDARY'] as const;

export type Env = Record<string, string | undefined>;

export type MissingPrerequisite = {
  ok: false;
  kind: 'MissingPrerequisite';
  missing: string[];
  skipped: false;
  disabledRoute: string;
};

export type AdmittedTestProfile = {
  name: string;
  seed: string;
  tools: {
    vitest: string;
    fastCheck: string;
    playwright: string;
  };
  postgres?: {
    urlPresent: true;
    disposableNamespace: string;
  };
  objectStorage?: {
    endpointPresent: true;
    disposableNamespace: string;
  };
};

export type ProfileResolution =
  | ({ ok: true; profile: AdmittedTestProfile })
  | MissingPrerequisite;

export type HarnessRunResult =
  | {
      ok: true;
      executedCount: number;
      skippedCount: 0;
      seed: string;
      logs: string[];
      dependencyVersions: Record<string, string>;
      profile: string;
    }
  | (MissingPrerequisite & { executedCount: 0; skippedCount: 0 });

/** Controllable clock — test-only composition. Never wire into production routes. */
export class TestClock {
  #now: Date;
  constructor(initialIso = '2026-09-04T00:00:00.000Z') {
    this.#now = new Date(initialIso);
  }
  now(): Date {
    return new Date(this.#now.getTime());
  }
  advanceMs(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('TestClock.advanceMs requires non-negative finite ms');
    this.#now = new Date(this.#now.getTime() + ms);
  }
  set(iso: string): void {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error('TestClock.set invalid iso');
    this.#now = d;
  }
}

/** Named barrier — test-only coordination. Never expose on production routes. */
export class NamedBarrier {
  readonly name: string;
  #open = false;
  #waiters: Array<() => void> = [];
  constructor(name: string) {
    if (!name || name.length > 128) throw new Error('NamedBarrier name required');
    this.name = name;
  }
  isOpen(): boolean {
    return this.#open;
  }
  open(): void {
    this.#open = true;
    const waiters = this.#waiters.splice(0);
    for (const w of waiters) w();
  }
  reset(): void {
    this.#open = false;
  }
  wait(timeoutMs = 5_000): Promise<void> {
    if (this.#open) return Promise.resolve();
    return new Promise((resolveWait, reject) => {
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((w) => w !== onOpen);
        reject(new Error(`NamedBarrier timeout: ${this.name}`));
      }, timeoutMs);
      const onOpen = () => {
        clearTimeout(timer);
        resolveWait();
      };
      this.#waiters.push(onOpen);
    });
  }
}

function readPackageDevDeps(root: string): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

function requireToolVersions(root: string): { ok: true; tools: AdmittedTestProfile['tools'] } | MissingPrerequisite {
  const deps = readPackageDevDeps(root);
  const missing: string[] = [];
  const vitest = deps['vitest'];
  const fastCheck = deps['fast-check'];
  const playwright = deps['playwright'] ?? deps['@playwright/test'];
  if (!vitest) missing.push('devDependency:vitest');
  if (!fastCheck) missing.push('devDependency:fast-check');
  if (!playwright) missing.push('devDependency:playwright');
  if (!existsSync(join(root, 'vitest.config.ts'))) missing.push('vitest.config.ts');
  if (!existsSync(join(root, 'playwright.config.ts'))) missing.push('playwright.config.ts');
  if (!existsSync(join(root, 'compose.test.yaml'))) missing.push('compose.test.yaml');
  if (missing.length) {
    return {
      ok: false,
      kind: 'MissingPrerequisite',
      missing,
      skipped: false,
      disabledRoute: DISABLED_ROUTE,
    };
  }
  return {
    ok: true,
    tools: { vitest: vitest!, fastCheck: fastCheck!, playwright: playwright! },
  };
}

/**
 * Resolve a named harness profile.
 * - `postgres-unconfigured`: always MissingPrerequisite (AC oracle)
 * - `component-harness`: requires pinned vitest/fast-check/playwright + configs
 * - `component-harness-with-postgres`: also requires ZOEN_TEST_DATABASE_URL
 * - `component-harness-full`: also requires object storage endpoint env
 */
export function resolveTestProfile(
  profileName: string,
  env: Env = process.env,
  root: string = DEFAULT_ROOT,
  options?: { seed?: string },
): ProfileResolution {
  const seed = options?.seed ?? FIXTURE_SEED;

  if (!profileName || profileName === 'postgres-unconfigured') {
    return {
      ok: false,
      kind: 'MissingPrerequisite',
      missing: ['real-postgresql-profile-unconfigured', 'ZOEN_TEST_DATABASE_URL'],
      skipped: false,
      disabledRoute: DISABLED_ROUTE,
    };
  }

  const tools = requireToolVersions(root);
  if (!tools.ok) return tools;

  if (profileName === 'component-harness') {
    return {
      ok: true,
      profile: {
        name: profileName,
        seed,
        tools: tools.tools,
      },
    };
  }

  if (profileName === 'component-harness-with-postgres' || profileName === 'component-harness-full') {
    const url = env.ZOEN_TEST_DATABASE_URL;
    if (!url) {
      return {
        ok: false,
        kind: 'MissingPrerequisite',
        missing: ['ZOEN_TEST_DATABASE_URL'],
        skipped: false,
        disabledRoute: DISABLED_ROUTE,
      };
    }
    const ns = env.ZOEN_TEST_NAMESPACE ?? `zn0004_${seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
    const base: AdmittedTestProfile = {
      name: profileName,
      seed,
      tools: tools.tools,
      postgres: { urlPresent: true, disposableNamespace: ns },
    };
    if (profileName === 'component-harness-full') {
      const endpoint = env.ZOEN_TEST_S3_ENDPOINT;
      if (!endpoint) {
        return {
          ok: false,
          kind: 'MissingPrerequisite',
          missing: ['ZOEN_TEST_S3_ENDPOINT'],
          skipped: false,
          disabledRoute: DISABLED_ROUTE,
        };
      }
      return {
        ok: true,
        profile: {
          ...base,
          objectStorage: { endpointPresent: true, disposableNamespace: ns },
        },
      };
    }
    return { ok: true, profile: base };
  }

  return {
    ok: false,
    kind: 'MissingPrerequisite',
    missing: [`unknown-profile:${profileName}`],
    skipped: false,
    disabledRoute: DISABLED_ROUTE,
  };
}

async function probePostgres(url: string, namespace: string): Promise<{ ok: true; version: string; log: string } | { ok: false; error: string }> {
  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
    await client.connect();
    try {
      const ver = await client.query<{ v: string }>('select version() as v');
      const schema = `harness_${namespace}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63);
      await client.query(`create schema if not exists ${schema}`);
      await client.query(`drop schema ${schema} cascade`);
      return {
        ok: true,
        version: ver.rows[0]?.v ?? 'unknown',
        log: `postgres probe ok schema=${schema}`,
      };
    } finally {
      await client.end();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Run harness for resolved profile. Never skips; zero executions are failures for callers.
 */
export async function runHarness(options: {
  profileName: string;
  env?: Env;
  root?: string;
  seed?: string;
  selectors?: string[];
}): Promise<HarnessRunResult> {
  const root = options.root ?? DEFAULT_ROOT;
  const resolved = resolveTestProfile(options.profileName, options.env ?? process.env, root, {
    seed: options.seed,
  });
  if (!resolved.ok) {
    return { ...resolved, executedCount: 0, skippedCount: 0 };
  }

  const logs: string[] = [];
  const dependencyVersions: Record<string, string> = {
    vitest: resolved.profile.tools.vitest,
    'fast-check': resolved.profile.tools.fastCheck,
    playwright: resolved.profile.tools.playwright,
    node: process.version,
  };
  let executedCount = 0;

  // Controllable clock + barrier smoke (test-only APIs)
  const clock = new TestClock('2026-09-04T12:00:00.000Z');
  clock.advanceMs(1000);
  logs.push(`clock=${clock.now().toISOString()}`);
  executedCount += 1;

  const barrier = new NamedBarrier('zn-0004-startup');
  const waitPromise = barrier.wait(2000);
  barrier.open();
  await waitPromise;
  logs.push(`barrier=${barrier.name}:opened`);
  executedCount += 1;

  // fast-check availability (no skip)
  try {
    const fc = await import('fast-check');
    const samples = fc.sample(fc.integer({ min: 0, max: 10 }), 3);
    logs.push(`fast-check samples=${samples.join(',')}`);
    dependencyVersions['fast-check-runtime'] = 'loaded';
    executedCount += 1;
  } catch (e) {
    return {
      ok: false,
      kind: 'MissingPrerequisite',
      missing: [`fast-check-load:${e instanceof Error ? e.message : String(e)}`],
      skipped: false,
      disabledRoute: DISABLED_ROUTE,
      executedCount: 0,
      skippedCount: 0,
    };
  }

  // vitest binary presence
  const vitestBin = join(root, 'node_modules/vitest/vitest.mjs');
  const vitestPkg = join(root, 'node_modules/vitest/package.json');
  if (!existsSync(vitestPkg)) {
    return {
      ok: false,
      kind: 'MissingPrerequisite',
      missing: ['node_modules/vitest'],
      skipped: false,
      disabledRoute: DISABLED_ROUTE,
      executedCount: 0,
      skippedCount: 0,
    };
  }
  const vitestMeta = JSON.parse(readFileSync(vitestPkg, 'utf8')) as { version: string };
  dependencyVersions['vitest-installed'] = vitestMeta.version;
  logs.push(`vitest-installed=${vitestMeta.version} bin=${existsSync(vitestBin)}`);
  executedCount += 1;

  if (resolved.profile.postgres) {
    const url = (options.env ?? process.env).ZOEN_TEST_DATABASE_URL!;
    const probe = await probePostgres(url, resolved.profile.postgres.disposableNamespace);
    if (!probe.ok) {
      return {
        ok: false,
        kind: 'MissingPrerequisite',
        missing: [`postgres-probe:${probe.error}`],
        skipped: false,
        disabledRoute: DISABLED_ROUTE,
        executedCount: 0,
        skippedCount: 0,
      };
    }
    dependencyVersions.postgresql = probe.version;
    logs.push(probe.log);
    executedCount += 1;
  }

  if (resolved.profile.objectStorage) {
    logs.push(`object-storage endpoint configured ns=${resolved.profile.objectStorage.disposableNamespace}`);
    executedCount += 1;
  }

  if (executedCount <= 0) {
    return {
      ok: false,
      kind: 'MissingPrerequisite',
      missing: ['zero-execution'],
      skipped: false,
      disabledRoute: DISABLED_ROUTE,
      executedCount: 0,
      skippedCount: 0,
    };
  }

  logs.push(`selectors=${(options.selectors ?? REQUIRED_CHECK_IDS).join(',')}`);
  return {
    ok: true,
    executedCount,
    skippedCount: 0,
    seed: resolved.profile.seed,
    logs,
    dependencyVersions,
    profile: resolved.profile.name,
  };
}

export function assertRequiredChecks(executedIds: string[], requiredIds: readonly string[] = REQUIRED_CHECK_IDS): void {
  if (executedIds.length === 0) throw new Error('zero-test run rejected');
  const missing = requiredIds.filter((id) => !executedIds.includes(id));
  if (missing.length) throw new Error(`missing required checks: ${missing.join(', ')}`);
}

export function digestReport(value: unknown): string {
  const stable = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  };
  return createHash('sha256').update(stable(value)).digest('hex');
}

export function newDisposableNamespace(prefix = 'zn0004'): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

function main(argv: string[]): number {
  const profile = argv[0] ?? 'postgres-unconfigured';
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '-e',
      `import { runHarness } from ${JSON.stringify(resolve(HERE, 'test-harness.ts'))}; const r = await runHarness({ profileName: ${JSON.stringify(profile)} }); console.log(JSON.stringify(r,null,2)); process.exit(r.ok?0:1);`,
    ],
    { encoding: 'utf8', cwd: DEFAULT_ROOT },
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.status ?? 1;
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === thisFile) {
  process.exit(main(process.argv.slice(2)));
}
