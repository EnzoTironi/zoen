import type { WorldRef } from '../../../kernel/src/ids.js';
import { sameWorld } from '../../../kernel/src/ids.js';
import { instant } from '../../../kernel/src/time.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
export type LinkRecord = Readonly<{
  world: WorldRef; reference: string; recipientId: string | null; expiresAt: string | null;
  state: 'active' | 'revoked'; appId: string; version: Readonly<{ kind: 'current' }> | Readonly<{ kind: 'pinned'; digest: string }>;
}>;
export type AppSession = Readonly<{
  id: string; principalId: string; world: WorldRef; purpose: string; linkReference: string;
  appId: string; manifestDigest: string; securityRevision: string; operations: readonly string[];
  issuedAt: string; idleExpiresAt: string; absoluteExpiresAt: string; state: 'active' | 'closed';
}>;
/** Only restrictions. World/field/source authorization MUST additionally pass at dispatch. */
export function assertLinkRestriction(link: LinkRecord | null, principalId: string, now: string): asserts link is LinkRecord {
  if (link === null || link.state !== 'active' || (link.recipientId !== null && link.recipientId !== principalId)
    || (link.expiresAt !== null && instant(link.expiresAt).nanoseconds <= instant(now).nanoseconds)) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
}
export function assertAppSession(session: AppSession, expected: Readonly<{ principalId: string; world: WorldRef; purpose: string; operation: string; securityRevision: string; manifestDigest: string }>, now: string): void {
  const time = instant(now).nanoseconds;
  if (session.state !== 'active' || session.principalId !== expected.principalId || !sameWorld(session.world, expected.world) || session.purpose !== expected.purpose) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
  if (time < instant(session.issuedAt).nanoseconds || time >= instant(session.idleExpiresAt).nanoseconds || time >= instant(session.absoluteExpiresAt).nanoseconds) throw new KernelError('Expired', 'APP_SESSION_EXPIRED');
  if (session.securityRevision !== expected.securityRevision) throw new KernelError('Denied', 'APP_SESSION_REAUTHORIZE');
  if (session.manifestDigest !== expected.manifestDigest) throw new KernelError('ContractChanged', 'APP_MANIFEST_CHANGED');
  if (!session.operations.includes(expected.operation)) throw new KernelError('Denied', 'APP_OPERATION_DENIED');
}
export function intersectCapabilities(...sets: readonly (readonly string[])[]): readonly string[] {
  requireThat(sets.length > 0 && sets.every(s => s.length <= 256), 'CAPABILITY_LIMIT');
  return Object.freeze([...new Set(sets[0])].filter(op => sets.every(set => set.includes(op))).sort());
}
export function requireInformationFlow(profile: Readonly<{ renderer: 'trusted-declarative' | 'executable'; classifiedData: boolean; disclosureApproved: boolean; isolatedHostAdmitted: boolean }>): void {
  if (profile.renderer === 'trusted-declarative') return;
  if (!profile.isolatedHostAdmitted || (profile.classifiedData && !profile.disclosureApproved)) throw new KernelError('Blocked', 'EXECUTABLE_DISCLOSURE_UNQUALIFIED');
}
