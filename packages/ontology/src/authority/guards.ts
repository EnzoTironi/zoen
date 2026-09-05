import type { Basis, DomainCut, Head } from '../../../contracts/src/semantic.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import { counter } from '../../../kernel/src/ids.js';
export type ReadGuard = Readonly<{ kind: 'domain' | 'absence' | 'range' | 'source-acl' | 'identity'; domainId: string; version: string; predicateDigest: string | null }>;
export function sortedDomains(domains: readonly string[]): readonly string[] {
  requireThat(domains.length > 0 && domains.length <= 256, 'DOMAIN_LOCK_LIMIT');
  requireThat(domains.every(id => /^[a-z][a-z0-9_.:-]{0,127}$/.test(id)), 'DOMAIN_ID'); return Object.freeze([...new Set(domains)].sort());
}
export function guardProjection(head: Head, cut: DomainCut): string { return canonicalJson({ head: { ...head }, cut: { ...cut } }); }
/** Validates conservative predicate fences, including absence/phantom protection. */
export function assertFresh(expected: Basis, actualHead: Head, actualCut: DomainCut, requiredDomains: readonly string[]): void {
  if (canonicalJson({ ...expected.head }) !== canonicalJson({ ...actualHead })) throw new KernelError('Stale', 'HEAD_CHANGED');
  const required = sortedDomains(requiredDomains);
  for (const domain of required) requireThat(Object.hasOwn(expected.cut, domain), 'INCOMPLETE_READ_GUARDS');
  for (const [domain, version] of Object.entries(expected.cut)) {
    counter(version); if (!Object.hasOwn(actualCut, domain) || actualCut[domain] !== version) throw new KernelError('Stale', 'READ_DEPENDENCY_CHANGED');
  }
}
export function isRetryableSql(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === '40001' || error.code === '40P01';
}
/** Transport and app labels never become a second idempotency namespace. */
export function operationScope(worldId: string, realm: string, principalId: string, operation: string, operationId: string): string {
  return canonicalJson([worldId, realm, principalId, operation, operationId]);
}

/** This candidate loads one image-bound definition, not an implicit live upgrade. */
export function assertLoadedRelease(active: string, loaded: string): void {
  if (active !== loaded) throw new KernelError('ContractChanged', 'ACTIVE_RELEASE_NOT_LOADED');
}
