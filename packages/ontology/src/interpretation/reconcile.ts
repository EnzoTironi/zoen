import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';
import { topological } from '../../../kernel/src/graph.js';
import { comparabilityKey, type Claim, type Verification } from './claims.js';
export type ResolutionRule = Readonly<{ kind: 'manual-required' }> | Readonly<{ kind: 'source-precedence'; sourceIds: readonly string[] }> | Readonly<{ kind: 'set-valued' }>;
export type Interpretation = Readonly<{
  status: 'unknown' | 'unresolved' | 'selected' | 'set-valued'; verification: Verification;
  contested: boolean; selectedRefs: readonly string[]; rivalRefs: readonly string[];
  values: readonly (string | boolean)[]; familyCount: number; dependencyRefs: readonly string[];
}>;
/** Correlated/copy families are collapsed transitively; provenance is retained. */
export function independentFamilies(claims: readonly Claim[]): readonly (readonly string[])[] {
  const ids = claims.map(c => c.id); requireThat(new Set(ids).size === ids.length, 'DUPLICATE_CLAIM');
  const set = new Set<string>(ids); const edges = claims.flatMap(c => c.derivedFrom.filter(id => set.has(id)).map(id => ({ from: id, to: c.id })));
  topological(ids, edges);
  const parent = new Map<string, string>(ids.map(id => [id, id]));
  function root(id: string): string { let node = id; while (parent.get(node) !== node) node = parent.get(node)!; return node; }
  function union(a: string, b: string): void { const x = root(a); const y = root(b); if (x !== y) parent.set(x < y ? y : x, x < y ? x : y); }
  const families = new Map<string, string>();
  for (const c of claims) { const previous = families.get(c.familyId); if (previous) union(previous, c.id); else families.set(c.familyId, c.id); }
  for (const edge of edges) union(edge.from, edge.to);
  const groups = new Map<string, string[]>();
  for (const id of ids) { const r = root(id); const group = groups.get(r) ?? []; group.push(id); groups.set(r, group); }
  return Object.freeze([...groups.values()].map(group => Object.freeze(group.sort())).sort((a, b) => a[0]! < b[0]! ? -1 : 1));
}
/**
 * Inputs MUST already be authorized, revision-filtered and comparable. This is not a
 * policy engine. Hidden claims must never be passed here and filtered after selection.
 */
export function interpretVisible(claims: readonly Claim[], rule: ResolutionRule): Interpretation {
  requireThat(claims.length <= 5000, 'CLAIM_LIMIT');
  if (claims.length > 0) { const key = comparabilityKey(claims[0]!); requireThat(claims.every(c => comparabilityKey(c) === key), 'NONCOMPARABLE_CLAIMS'); }
  const families = independentFamilies(claims);
  const allRefs = claims.map(c => c.id).sort(); const byValue = new Map<string, Claim[]>();
  for (const claim of claims) { const key = canonicalJson(claim.value); const group = byValue.get(key) ?? []; group.push(claim); byValue.set(key, group); }
  const contested = byValue.size > 1; let chosen: readonly Claim[] = []; let status: Interpretation['status'];
  if (claims.length === 0) status = 'unknown';
  else if (rule.kind === 'set-valued') { status = 'set-valued'; chosen = claims; }
  else if (!contested) { status = 'selected'; chosen = claims; }
  else if (rule.kind === 'source-precedence') {
    requireThat(rule.sourceIds.length <= 100 && new Set(rule.sourceIds).size === rule.sourceIds.length, 'PRECEDENCE_LIST');
    let preferred: readonly Claim[] = [];
    for (const source of rule.sourceIds) { preferred = claims.filter(c => c.sourceId === source); if (preferred.length > 0) break; }
    if (preferred.length > 0 && new Set(preferred.map(c => canonicalJson(c.value))).size === 1) {
      status = 'selected'; const preferredValue = canonicalJson(preferred[0]!.value); chosen = claims.filter(c => canonicalJson(c.value) === preferredValue);
    } else status = 'unresolved';
  } else status = 'unresolved';
  const selectedRefs = chosen.map(c => c.id).sort(); const selectedSet = new Set<string>(selectedRefs);
  // Conservative axis: copying a verified statement does not upgrade unverified provenance.
  const verification: Verification = chosen.length > 0 && chosen.every(c => c.verification === 'verified') ? 'verified'
    : chosen.length > 0 && chosen.every(c => c.verification !== 'unverified') ? 'attested' : 'unverified';
  const values = [...new Map(chosen.map(c => [canonicalJson(c.value), c.value])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
  return Object.freeze({ status, verification, contested, selectedRefs: Object.freeze(selectedRefs), rivalRefs: Object.freeze(allRefs.filter(id => !selectedSet.has(id))), values: Object.freeze(values), familyCount: families.length, dependencyRefs: Object.freeze(allRefs) });
}
