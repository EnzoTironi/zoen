import { assertWorld, counter, digest, semanticId, uuid, worldRef, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson, exactKeys, list, object, text, type JsonObject, type JsonValue } from '../../../kernel/src/json.js';
import { canonicalDecimal, parseDecimal } from '../../../kernel/src/decimal.js';
import { instant, interval, localDate, type Interval } from '../../../kernel/src/time.js';
import { requireThat } from '../../../kernel/src/result.js';
export type ValidTime = Readonly<{ kind: 'unknown' }> | Readonly<{ kind: 'date' | 'instant'; from: string; until: string | null }>;
export type Verification = 'unverified' | 'attested' | 'verified';
export type Claim = Readonly<{
  id: UUID; world: WorldRef; subjectId: UUID; predicateId: string; definitionDigest: string;
  valueType: 'decimal' | 'string' | 'boolean'; value: string | boolean; unit: string | null;
  scope: JsonObject; validTime: ValidTime; knowledgeVersion: string;
  sourceId: UUID; familyId: UUID; evidenceRefs: readonly UUID[]; derivedFrom: readonly UUID[];
  verification: Verification;
}>;
export function parseValidTime(value: JsonValue): ValidTime {
  const v = object(value);
  if (v['kind'] === 'unknown') { exactKeys(v, ['kind']); return Object.freeze({ kind: 'unknown' }); }
  exactKeys(v, ['kind', 'from', 'until']); requireThat(v['kind'] === 'date' || v['kind'] === 'instant', 'VALID_TIME_KIND');
  const parse = v['kind'] === 'date' ? localDate : instant;
  const from = parse(text(v['from'])); const until = v['until'] === null ? null : parse(text(v['until'])); interval(from, until);
  return Object.freeze({ kind: v['kind'], from: from.iso, until: until?.iso ?? null });
}
export function validity(value: ValidTime): Interval {
  if (value.kind === 'unknown') return value;
  const parse = value.kind === 'date' ? localDate : instant;
  return interval(parse(value.from), value.until === null ? null : parse(value.until));
}
export function parseClaim(value: JsonValue): Claim {
  const v = object(value); exactKeys(v, ['id', 'world', 'subjectId', 'predicateId', 'definitionDigest', 'valueType', 'value', 'unit', 'scope', 'validTime', 'knowledgeVersion', 'sourceId', 'familyId', 'evidenceRefs', 'derivedFrom', 'verification']);
  const kind = v['valueType']; requireThat(kind === 'decimal' || kind === 'string' || kind === 'boolean', 'CLAIM_VALUE_TYPE');
  let normalized: string | boolean;
  if (kind === 'boolean') { requireThat(typeof v['value'] === 'boolean', 'CLAIM_VALUE_TYPE'); normalized = v['value']; }
  else normalized = kind === 'decimal' ? canonicalDecimal(parseDecimal(text(v['value'], 41))) : text(v['value'], 10_000);
  const verification = v['verification']; requireThat(verification === 'unverified' || verification === 'attested' || verification === 'verified', 'VERIFICATION');
  const parseRefs = (raw: JsonValue): readonly UUID[] => {
    const refs = list(raw, 100).map(item => uuid(text(item))); requireThat(new Set(refs).size === refs.length, 'DUPLICATE_REF'); return Object.freeze(refs);
  };
  const scope = object(v['scope']!); requireThat(canonicalJson(scope).length <= 8192, 'SCOPE_LIMIT');
  const unit = v['unit'] === null ? null : semanticId(text(v['unit'])); requireThat(kind === 'decimal' || unit === null, 'UNIT_ON_NON_QUANTITY');
  return Object.freeze({ id: uuid(text(v['id'])), world: worldRef(v['world']!), subjectId: uuid(text(v['subjectId'])), predicateId: semanticId(text(v['predicateId'])), definitionDigest: digest(text(v['definitionDigest'])), valueType: kind, value: normalized, unit, scope, validTime: parseValidTime(v['validTime']!), knowledgeVersion: counter(text(v['knowledgeVersion'])), sourceId: uuid(text(v['sourceId'])), familyId: uuid(text(v['familyId'])), evidenceRefs: parseRefs(v['evidenceRefs']!), derivedFrom: parseRefs(v['derivedFrom']!), verification });
}
/** Unknown valid time deliberately does not establish comparability between two records. */
export function comparabilityKey(claim: Claim): string {
  return canonicalJson({ world: { ...claim.world }, subjectId: claim.subjectId, predicateId: claim.predicateId, definitionDigest: claim.definitionDigest, valueType: claim.valueType, unit: claim.unit, scope: claim.scope, validTime: claim.validTime.kind === 'unknown' ? { kind: 'unknown', isolatedClaim: claim.id } : { ...claim.validTime } });
}
export function comparableGroups(claims: readonly Claim[], world: WorldRef): readonly (readonly Claim[])[] {
  requireThat(claims.length <= 5000 && new Set(claims.map(c => c.id)).size === claims.length, 'CLAIM_SET_LIMIT_OR_DUPLICATE');
  const groups = new Map<string, Claim[]>();
  for (const claim of claims) { assertWorld(world, claim.world); const key = comparabilityKey(claim); const group = groups.get(key) ?? []; group.push(claim); groups.set(key, group); }
  return Object.freeze([...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, group]) => Object.freeze(group.sort((a, b) => a.id < b.id ? -1 : 1))));
}
