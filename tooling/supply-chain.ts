/**
 * ZN-0006 — secrets, artifacts and merge/promotion policy.
 * Denies promotion on lock mismatch or unsigned images; never prints credentials.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, '..');
export const SCHEMA_VERSION = 'spec-000.supply-chain.v1';
export const DISABLED_ROUTE = 'release-promotion-and-merge';
export const FIXTURE_SEED = 'zn-0006-supply-chain-seed-v1';

export type SbomPackage = {
  name: string;
  version: string;
  integrity?: string;
  license?: string | null;
};

export type PromotionDenial = {
  ok: false;
  denied: true;
  code: string;
  mismatch: string;
  evidence: string[];
  disabledRoute: string;
  redacted: true;
};

export type PromotionAllow = {
  ok: true;
  denied: false;
  sbomDigest: string;
  provenanceDigest: string;
  evidence: string[];
};

export type PromotionResult = PromotionAllow | PromotionDenial;

export type SigningIdentity = {
  status: 'admitted' | 'MissingPrerequisite';
  identityRef?: string;
  missing?: string[];
};

function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const o = value as Record<string, unknown>;
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

function redactSecrets(text: string): string {
  const credAssign = new RegExp('(password|secret|token|api[_-]?key|authorization)=([^\\s&]+)', 'gi');
  const urlUserPass = new RegExp('://([^:@/]+):([^@/]+)@', 'g');
  const integrity = new RegExp('sha512-[A-Za-z0-9+/=]{20,}', 'g');
  return text
    .replace(credAssign, '$1=<redacted>')
    .replace(urlUserPass, '://$1:<redacted>@')
    .replace(integrity, (m) => m.slice(0, 18) + '…');
}

export function readLockfilePackages(root: string = DEFAULT_ROOT): {
  lockPath: string;
  lockDigest: string;
  packages: SbomPackage[];
} {
  const lockPath = join(root, 'pnpm-lock.yaml');
  if (!existsSync(lockPath)) {
    throw new Error('MissingPrerequisite: pnpm-lock.yaml');
  }
  const raw = readFileSync(lockPath, 'utf8');
  const lockDigest = sha256Text(raw);
  const packages: SbomPackage[] = [];
  // Minimal parse of importers root dependencies from package.json + lock presence
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, version] of Object.entries(all)) {
    packages.push({ name, version: String(version).replace(/^[^\d]*/, '') || String(version) });
  }
  return { lockPath, lockDigest, packages };
}

export function generateSbom(root: string = DEFAULT_ROOT): {
  schemaVersion: string;
  lockDigest: string;
  packages: SbomPackage[];
  digest: string;
} {
  const { lockDigest, packages } = readLockfilePackages(root);
  const doc = {
    schemaVersion: 'spec-000.sbom.v1',
    ticket: 'ZN-0006',
    lockDigest,
    packages: packages.sort((a, b) => a.name.localeCompare(b.name)),
  };
  return { schemaVersion: doc.schemaVersion, lockDigest, packages: doc.packages, digest: sha256Text(stableStringify(doc)) };
}

export function generateProvenance(options: {
  root?: string;
  sourceCommit: string;
  lockDigest: string;
  sbomDigest: string;
  builderId?: string;
}): { digest: string; document: Record<string, unknown> } {
  const document = {
    schemaVersion: 'spec-000.provenance.v1',
    ticket: 'ZN-0006',
    sourceCommit: options.sourceCommit,
    lockDigest: options.lockDigest,
    sbomDigest: options.sbomDigest,
    builderId: options.builderId ?? 'zoen-local-builder',
    // No fabricated signatures here
    signature: null as null,
  };
  return { document, digest: sha256Text(stableStringify(document)) };
}

export function resolveSigningIdentity(env: Record<string, string | undefined> = process.env): SigningIdentity {
  const ref = env.ZOEN_ADMITTED_SIGNING_IDENTITY;
  if (!ref) {
    return {
      status: 'MissingPrerequisite',
      missing: ['ZOEN_ADMITTED_SIGNING_IDENTITY'],
    };
  }
  // Never echo secret material — only opaque reference name/path marker
  if (ref.includes('BEGIN') || ref.length > 256) {
    return {
      status: 'MissingPrerequisite',
      missing: ['signing-identity-must-be-opaque-reference'],
    };
  }
  return { status: 'admitted', identityRef: ref };
}

export function scanForSecrets(text: string): { findings: string[]; redactedPreview: string } {
  const findings: string[] = [];
  if (/BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/.test(text)) findings.push('private-key-material');
  if (/AKIA[0-9A-Z]{16}/.test(text)) findings.push('aws-access-key-id-pattern');
  if (/password\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(text)) findings.push('password-assignment');
  if (/api[_-]?key\s*[:=]\s*['"]?[^'"\s]{8,}/i.test(text)) findings.push('api-key-assignment');
  return { findings, redactedPreview: redactSecrets(text).slice(0, 200) };
}

export function evaluateLicensePolicy(packages: SbomPackage[]): { ok: boolean; violations: string[] } {
  const denied = new Set(['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0']);
  const violations: string[] = [];
  for (const p of packages) {
    if (p.license && denied.has(p.license)) {
      violations.push(`${p.name}@${p.version} license=${p.license}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Evaluate release promotion eligibility.
 * - Declared dependency set must match lock digest expectation
 * - Images must carry digest + admitted signature reference
 */
export function evaluatePromotion(input: {
  root?: string;
  sourceCommit: string;
  declaredDependencies: Record<string, string>;
  expectedLockDigest?: string;
  image?: { reference: string; digest?: string; signatureRef?: string };
  signingEnv?: Record<string, string | undefined>;
}): PromotionResult {
  const root = input.root ?? DEFAULT_ROOT;
  const evidence: string[] = [];
  const sbom = generateSbom(root);
  evidence.push(`sbomDigest=${sbom.digest}`);
  evidence.push(`lockDigest=${sbom.lockDigest}`);

  // Dependency changed without lock update
  if (input.expectedLockDigest && input.expectedLockDigest !== sbom.lockDigest) {
    return {
      ok: false,
      denied: true,
      code: 'lock-digest-mismatch',
      mismatch: `expectedLockDigest!=actualLockDigest`,
      evidence: [...evidence, 'dependency-or-lock-changed-without-matching-digest'],
      disabledRoute: DISABLED_ROUTE,
      redacted: true,
    };
  }

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const actual = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, version] of Object.entries(input.declaredDependencies)) {
    if (actual[name] !== version) {
      // Declared view differs from package.json — if lock digest not refreshed, deny
      if (!input.expectedLockDigest || input.expectedLockDigest === sbom.lockDigest) {
        return {
          ok: false,
          denied: true,
          code: 'dependency-changed-without-lock-update',
          mismatch: `package:${name}`,
          evidence: [
            ...evidence,
            `declared ${name}@${version} vs package.json ${actual[name] ?? 'missing'}`,
            'lock-digest-unchanged-while-dependency-declaration-diverged',
          ],
          disabledRoute: DISABLED_ROUTE,
          redacted: true,
        };
      }
    }
  }

  if (input.image) {
    if (!input.image.digest || !/^sha256:[0-9a-f]{64}$/.test(input.image.digest)) {
      return {
        ok: false,
        denied: true,
        code: 'image-digest-missing',
        mismatch: `image:${input.image.reference}`,
        evidence: [...evidence, 'mutable-tag-or-missing-digest'],
        disabledRoute: DISABLED_ROUTE,
        redacted: true,
      };
    }
    const signing = resolveSigningIdentity(input.signingEnv ?? process.env);
    if (signing.status !== 'admitted') {
      return {
        ok: false,
        denied: true,
        code: 'signing-identity-missing',
        mismatch: 'ZOEN_ADMITTED_SIGNING_IDENTITY',
        evidence: [...evidence, `missing=${(signing.missing ?? []).join(',')}`],
        disabledRoute: DISABLED_ROUTE,
        redacted: true,
      };
    }
    if (!input.image.signatureRef) {
      return {
        ok: false,
        denied: true,
        code: 'unsigned-image',
        mismatch: `image:${input.image.reference}@${input.image.digest}`,
        evidence: [...evidence, `signingIdentityRef=${signing.identityRef}`, 'signature-absent'],
        disabledRoute: DISABLED_ROUTE,
        redacted: true,
      };
    }
  }

  const provenance = generateProvenance({
    root,
    sourceCommit: input.sourceCommit,
    lockDigest: sbom.lockDigest,
    sbomDigest: sbom.digest,
  });
  evidence.push(`provenanceDigest=${provenance.digest}`);

  return {
    ok: true,
    denied: false,
    sbomDigest: sbom.digest,
    provenanceDigest: provenance.digest,
    evidence,
  };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function main(argv: string[]): number {
  const mode = argv[0] ?? 'check-promotion';
  if (mode === 'sbom') {
    const sbom = generateSbom(DEFAULT_ROOT);
    process.stdout.write(JSON.stringify(sbom, null, 2) + '\n');
    return 0;
  }
  // Default: deny unsigned promotion sample (fail closed in CI without explicit allow)
  const result = evaluatePromotion({
    sourceCommit: 'unknown',
    declaredDependencies: {},
    image: { reference: 'zoen/app:latest' },
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result.ok ? 0 : 1;
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === thisFile) {
  process.exit(main(process.argv.slice(2)));
}
