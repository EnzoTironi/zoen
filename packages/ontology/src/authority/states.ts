import { KernelError, requireThat } from '../../../kernel/src/result.js';
export const CASE_TRANSITIONS = Object.freeze({
  proposed: ['approved', 'rejected', 'cancelled', 'expired', 'stale', 'blocked'],
  approved: ['committed', 'cancelled', 'expired', 'stale', 'blocked'],
  blocked: ['cancelled', 'expired'], rejected: [], cancelled: [], expired: [], stale: [], committed: [],
} as const);
export type CaseState = keyof typeof CASE_TRANSITIONS;
export function caseTransition(from: CaseState, to: CaseState): CaseState {
  requireThat((CASE_TRANSITIONS[from] as readonly string[]).includes(to), 'ILLEGAL_CASE_TRANSITION'); return to;
}
export type EffectState = 'intent' | 'attempting' | 'unknown' | 'accepted' | 'rejected' | 'cancelled';
export type EffectEvent = 'start' | 'lost-response' | 'provider-accepted' | 'provider-rejected' | 'cancel-before-start';
/** No unknown->attempting retry exists without a separately qualified reconciliation contract. */
export function effectTransition(from: EffectState, event: EffectEvent): EffectState {
  if (from === 'intent' && event === 'start') return 'attempting';
  if (from === 'intent' && event === 'cancel-before-start') return 'cancelled';
  if (from === 'attempting' && event === 'lost-response') return 'unknown';
  if ((from === 'attempting' || from === 'unknown') && event === 'provider-accepted') return 'accepted';
  if ((from === 'attempting' || from === 'unknown') && event === 'provider-rejected') return 'rejected';
  throw new KernelError('Conflict', 'ILLEGAL_EFFECT_TRANSITION');
}
export const RELEASE_TRANSITIONS = Object.freeze({
  draft: ['validated', 'rejected'], validated: ['evaluated', 'rejected'], evaluated: ['prepared', 'rejected'],
  prepared: ['approved', 'stale', 'rejected'], approved: ['activated', 'stale', 'rejected'],
  activated: [], rejected: [], stale: [],
} as const);
export type ReleaseState = keyof typeof RELEASE_TRANSITIONS;
export function releaseTransition(from: ReleaseState, to: ReleaseState): ReleaseState {
  requireThat((RELEASE_TRANSITIONS[from] as readonly string[]).includes(to), 'ILLEGAL_RELEASE_TRANSITION'); return to;
}
export type Lease = Readonly<{ owner: string; fence: string; until: string }>;
export function assertLease(current: Lease, presented: Lease, now: string): void {
  if (current.owner !== presented.owner || current.fence !== presented.fence || current.until !== presented.until || Date.parse(current.until) <= Date.parse(now)) throw new KernelError('LostLease', 'LEASE_NOT_CURRENT');
  requireThat(Number.isFinite(Date.parse(now)) && Number.isFinite(Date.parse(current.until)), 'LEASE_TIME');
}
