import type { Basis, DomainCut, Head } from '../../../contracts/src/semantic.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import { counter } from '../../../kernel/src/ids.js';

export type ReadGuard = Readonly<{
  kind: 'domain' | 'absence' | 'range' | 'source-acl' | 'identity';
  domainId: string;
  version: string;
  predicateDigest: string | null;
}>;

export type GuardContext = Readonly<{
  sourceWatermark?: string | null;
  identityRevision?: string | null;
  clockExpiry?: string | null;
  now?: string | null;
  policyHeadDigest?: string | null;
  actualPolicyHeadDigest?: string | null;
  actualSourceWatermark?: string | null;
  actualIdentityRevision?: string | null;
}>;

export function sortedDomains(domains: readonly string[]): readonly string[] {
  requireThat(domains.length > 0 && domains.length <= 256, 'DOMAIN_LOCK_LIMIT');
  requireThat(domains.every((id) => /^[a-z][a-z0-9_.:-]{0,127}$/.test(id)), 'DOMAIN_ID');
  return Object.freeze([...new Set(domains)].sort());
}

export function guardProjection(head: Head, cut: DomainCut): string {
  return canonicalJson({ head: { ...head }, cut: { ...cut } });
}

/** Validates conservative predicate fences, including absence/phantom protection. */
export function assertFresh(
  expected: Basis,
  actualHead: Head,
  actualCut: DomainCut,
  requiredDomains: readonly string[],
): void {
  if (canonicalJson({ ...expected.head }) !== canonicalJson({ ...actualHead })) {
    throw new KernelError('Stale', 'HEAD_CHANGED');
  }
  const required = sortedDomains(requiredDomains);
  for (const domain of required) requireThat(Object.hasOwn(expected.cut, domain), 'INCOMPLETE_READ_GUARDS');
  for (const [domain, version] of Object.entries(expected.cut)) {
    counter(version);
    if (!Object.hasOwn(actualCut, domain) || actualCut[domain] !== version) {
      throw new KernelError('Stale', 'READ_DEPENDENCY_CHANGED');
    }
  }
}

/**
 * Build an absence/phantom fence: "no matching rows in domain at this version".
 * predicateDigest binds the exact absence query shape (not row versions alone).
 */
export function absenceGuard(
  domainId: string,
  version: string,
  predicateDigest: string,
): ReadGuard {
  requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(domainId), 'DOMAIN_ID');
  counter(version);
  requireThat(/^[a-f0-9]{64}$/.test(predicateDigest), 'PREDICATE_DIGEST');
  return Object.freeze({
    kind: 'absence' as const,
    domainId,
    version,
    predicateDigest,
  });
}

export function domainGuard(domainId: string, version: string): ReadGuard {
  requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(domainId), 'DOMAIN_ID');
  counter(version);
  return Object.freeze({
    kind: 'domain' as const,
    domainId,
    version,
    predicateDigest: null,
  });
}

/**
 * Recheck saved guards against the live cut (+ optional source/identity/clock/policy).
 * Any mismatch → Stale without recomputing the approved intent.
 */
export function assertGuardsFresh(
  guards: readonly ReadGuard[],
  actualCut: DomainCut,
  context: GuardContext = {},
): void {
  requireThat(guards.length > 0 && guards.length <= 256, 'GUARD_LIMIT');
  for (const guard of guards) {
    counter(guard.version);
    requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(guard.domainId), 'DOMAIN_ID');
    const live = actualCut[guard.domainId];
    if (live === undefined || live !== guard.version) {
      throw new KernelError('Stale', 'READ_DEPENDENCY_CHANGED');
    }
    if (guard.kind === 'absence' || guard.kind === 'range') {
      requireThat(
        typeof guard.predicateDigest === 'string' && /^[a-f0-9]{64}$/.test(guard.predicateDigest),
        'PREDICATE_DIGEST',
      );
    }
    if (guard.kind === 'source-acl') {
      if (
        context.actualSourceWatermark !== undefined &&
        context.actualSourceWatermark !== null &&
        context.sourceWatermark !== context.actualSourceWatermark
      ) {
        throw new KernelError('Stale', 'SOURCE_WATERMARK_CHANGED');
      }
    }
    if (guard.kind === 'identity') {
      if (
        context.actualIdentityRevision !== undefined &&
        context.actualIdentityRevision !== null &&
        context.identityRevision !== context.actualIdentityRevision
      ) {
        throw new KernelError('Stale', 'IDENTITY_REVISION_CHANGED');
      }
    }
  }
  if (
    context.clockExpiry !== undefined &&
    context.clockExpiry !== null &&
    context.now !== undefined &&
    context.now !== null &&
    context.now > context.clockExpiry
  ) {
    throw new KernelError('Stale', 'GUARD_CLOCK_EXPIRED');
  }
  if (
    context.policyHeadDigest !== undefined &&
    context.policyHeadDigest !== null &&
    context.actualPolicyHeadDigest !== undefined &&
    context.actualPolicyHeadDigest !== null &&
    context.policyHeadDigest !== context.actualPolicyHeadDigest
  ) {
    throw new KernelError('Stale', 'POLICY_HEAD_CHANGED');
  }
}

/** Domains that must be locked when evaluating these guards. */
export function guardDomains(guards: readonly ReadGuard[]): readonly string[] {
  return sortedDomains(guards.map((g) => g.domainId));
}

export function isRetryableSql(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === '40001' || error.code === '40P01';
}

/** Transport and app labels never become a second idempotency namespace. */
export function operationScope(
  worldId: string,
  realm: string,
  principalId: string,
  operation: string,
  operationId: string,
): string {
  return canonicalJson([worldId, realm, principalId, operation, operationId]);
}

/** This candidate loads one image-bound definition, not an implicit live upgrade. */
export function assertLoadedRelease(active: string, loaded: string): void {
  if (active !== loaded) throw new KernelError('ContractChanged', 'ACTIVE_RELEASE_NOT_LOADED');
}
