import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';
import {
  compare,
  convertQuantity,
  money,
  quantity,
  type ReleasedConversion,
} from '../../../kernel/src/decimal.js';
import { overlaps, interval, localDate } from '../../../kernel/src/time.js';
import type {
  ComparableGroup,
  CompareClaimsInput,
  CompareClaimsOutcome,
  InterpretationClaim,
  MeaningProfile,
  NonComparablePartition,
} from './types.js';

export const COMPARER_IMPL = 'compare-claims-v1';

const KNOWN_METRIC_PREDICATES: Readonly<Record<string, string>> = Object.freeze({
  'crm.bookings': 'bookings',
  'erp.invoiced': 'invoiced',
  'bank.received': 'received',
});

export function metricLabelForPredicate(predicateId: string): string {
  return KNOWN_METRIC_PREDICATES[predicateId] ?? predicateId;
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function scopeDigest(scope: Readonly<Record<string, string>>): string {
  const keys = Object.keys(scope).sort();
  const ordered: Record<string, string> = {};
  for (const k of keys) ordered[k] = scope[k]!;
  return sha256Text(canonicalJson(ordered as never));
}

/**
 * Canonical comparison key: semantic predicate + subject + scope + valid interval.
 * Distinct predicates (bookings vs invoiced vs received) never share a key.
 */
export function buildComparisonKey(claim: InterpretationClaim): string {
  const payload = {
    predicateId: claim.predicateId,
    subjectId: claim.subjectId,
    scope: Object.fromEntries(Object.keys(claim.scope).sort().map((k) => [k, claim.scope[k]!])),
    validFrom: claim.validFrom,
    validUntil: claim.validUntil,
  };
  return sha256Text(canonicalJson(payload as never));
}

function meaningBasis(profile: MeaningProfile): string {
  return sha256Text(
    canonicalJson({
      profileId: profile.profileId,
      knowledgeVersion: profile.knowledgeVersion,
      releaseDigest: profile.releaseDigest,
      comparer: COMPARER_IMPL,
    } as never),
  );
}

function validateClaim(claim: InterpretationClaim): string | null {
  if (!claim.predicateId || claim.predicateId.length > 128) return 'INVALID_PREDICATE';
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(claim.amount)) return 'INVALID_AMOUNT';
  if (claim.measureKind === 'money') {
    if (!/^[A-Z]{3}$/.test(claim.unitOrCurrency)) return 'INVALID_CURRENCY';
  } else if (!/^[a-z][a-z0-9]{0,15}$/.test(claim.unitOrCurrency)) {
    return 'INVALID_UNIT';
  }
  try {
    localDate(claim.validFrom);
    if (claim.validUntil !== null) localDate(claim.validUntil);
  } catch {
    return 'INVALID_INTERVAL';
  }
  return null;
}

function intervalsCompatible(a: InterpretationClaim, b: InterpretationClaim): boolean {
  try {
    const ia = interval(localDate(a.validFrom), a.validUntil ? localDate(a.validUntil) : null);
    const ib = interval(localDate(b.validFrom), b.validUntil ? localDate(b.validUntil) : null);
    return overlaps(ia, ib);
  } catch {
    return false;
  }
}

function sameScope(a: InterpretationClaim, b: InterpretationClaim): boolean {
  return scopeDigest(a.scope) === scopeDigest(b.scope);
}

function findConversion(
  fromUnit: string,
  toUnit: string,
  conversions: readonly ReleasedConversion[],
): ReleasedConversion | undefined {
  return conversions.find(
    (c) =>
      (c.fromUnit === fromUnit && c.toUnit === toUnit) ||
      (c.fromUnit === toUnit && c.toUnit === fromUnit),
  );
}

function amountsComparable(
  a: InterpretationClaim,
  b: InterpretationClaim,
  conversions: readonly ReleasedConversion[],
): { ok: true; order: -1 | 0 | 1 } | { ok: false; reason: 'INCOMPATIBLE_UNIT' | 'MISSING_CONVERSION' } {
  if (a.measureKind !== b.measureKind) return { ok: false, reason: 'INCOMPATIBLE_UNIT' };
  if (a.measureKind === 'money') {
    if (a.unitOrCurrency !== b.unitOrCurrency) return { ok: false, reason: 'INCOMPATIBLE_UNIT' };
    const ma = money(a.amount, a.unitOrCurrency);
    const mb = money(b.amount, b.unitOrCurrency);
    return { ok: true, order: compare(ma.amount, mb.amount) };
  }
  if (a.unitOrCurrency === b.unitOrCurrency) {
    const qa = quantity(a.amount, a.unitOrCurrency);
    const qb = quantity(b.amount, b.unitOrCurrency);
    return { ok: true, order: compare(qa.amount, qb.amount) };
  }
  const conv = findConversion(a.unitOrCurrency, b.unitOrCurrency, conversions);
  if (!conv) return { ok: false, reason: 'MISSING_CONVERSION' };
  try {
    const qa = quantity(a.amount, a.unitOrCurrency);
    const qb = quantity(b.amount, b.unitOrCurrency);
    if (conv.fromUnit === a.unitOrCurrency && conv.toUnit === b.unitOrCurrency) {
      const converted = convertQuantity(qa, conv);
      return { ok: true, order: compare(converted.amount, qb.amount) };
    }
    const converted = convertQuantity(qb, conv);
    return { ok: true, order: compare(qa.amount, converted.amount) };
  } catch {
    return { ok: false, reason: 'MISSING_CONVERSION' };
  }
}

function buildGroups(
  authorized: readonly InterpretationClaim[],
  profile: MeaningProfile,
): {
  groups: ComparableGroup[];
  partitions: NonComparablePartition[];
  numericalContradiction: boolean;
  explanations: string[];
} {
  const byKey = new Map<string, InterpretationClaim[]>();
  for (const claim of authorized) {
    const key = buildComparisonKey(claim);
    const bucket = byKey.get(key) ?? [];
    bucket.push(claim);
    byKey.set(key, bucket);
  }

  const groups: ComparableGroup[] = [];
  const partitions: NonComparablePartition[] = [];
  let numericalContradiction = false;

  for (const [key, claims] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const head = claims[0]!;
    // Within a key, predicates/subjects/scopes/intervals already match by construction.
    let unitMismatch = false;
    for (let i = 1; i < claims.length; i++) {
      const cmp = amountsComparable(head, claims[i]!, profile.releasedConversions);
      if (!cmp.ok) {
        unitMismatch = true;
        partitions.push(
          Object.freeze({
            reason: cmp.reason,
            predicateIds: Object.freeze([head.predicateId]),
            claimIds: Object.freeze(claims.map((c) => c.claimId)),
            explanation: `Claims under ${metricLabelForPredicate(head.predicateId)} are not convertible without released evidence-bound factors`,
          }),
        );
        break;
      }
      if (cmp.order !== 0) numericalContradiction = true;
    }
    if (unitMismatch) continue;

    groups.push(
      Object.freeze({
        comparisonKey: key,
        predicateId: head.predicateId,
        subjectId: head.subjectId,
        scopeDigest: scopeDigest(head.scope),
        validFrom: head.validFrom,
        validUntil: head.validUntil,
        claimIds: Object.freeze(claims.map((c) => c.claimId)),
        amounts: Object.freeze(claims.map((c) => c.amount)),
        unitOrCurrency: head.unitOrCurrency,
        measureKind: head.measureKind,
        metricLabel: metricLabelForPredicate(head.predicateId),
      }),
    );
  }

  // Cross-predicate: never invent numerical contradiction — explain distinct metrics.
  const predicateSet = [...new Set(authorized.map((c) => c.predicateId))].sort();
  const explanations: string[] = [];
  if (predicateSet.length >= 2) {
    const labels = predicateSet.map(metricLabelForPredicate);
    explanations.push(
      `Distinct semantic predicates (${labels.join(', ')}) are separate metrics; values are not numerically contradicted across predicates.`,
    );
    partitions.push(
      Object.freeze({
        reason: 'DISTINCT_PREDICATE' as const,
        predicateIds: Object.freeze(predicateSet),
        claimIds: Object.freeze(authorized.map((c) => c.claimId)),
        explanation: explanations[0]!,
      }),
    );
  }
  for (const g of groups) {
    explanations.push(
      `Metric ${g.metricLabel}: ${g.amounts.join(', ')} ${g.unitOrCurrency} (${g.claimIds.length} claim(s)).`,
    );
  }

  // Also surface subject/scope/interval mismatches between same-predicate claims that did not share a key
  const byPredSubject = new Map<string, InterpretationClaim[]>();
  for (const c of authorized) {
    const k = `${c.predicateId}|${c.subjectId}`;
    const bucket = byPredSubject.get(k) ?? [];
    bucket.push(c);
    byPredSubject.set(k, bucket);
  }
  for (const claims of byPredSubject.values()) {
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i]!;
        const b = claims[j]!;
        if (!sameScope(a, b)) {
          partitions.push(
            Object.freeze({
              reason: 'SCOPE_MISMATCH' as const,
              predicateIds: Object.freeze([a.predicateId]),
              claimIds: Object.freeze([a.claimId, b.claimId]),
              explanation: 'Same predicate/subject with incompatible scope are not compared',
            }),
          );
        } else if (!intervalsCompatible(a, b) && buildComparisonKey(a) !== buildComparisonKey(b)) {
          partitions.push(
            Object.freeze({
              reason: 'INTERVAL_MISMATCH' as const,
              predicateIds: Object.freeze([a.predicateId]),
              claimIds: Object.freeze([a.claimId, b.claimId]),
              explanation: 'Same predicate/subject/scope with non-overlapping valid intervals are not compared',
            }),
          );
        }
      }
    }
  }

  return {
    groups: Object.freeze(groups) as ComparableGroup[],
    partitions: Object.freeze(partitions) as NonComparablePartition[],
    numericalContradiction,
    explanations: Object.freeze(explanations) as string[],
  };
}

function digestResult(parts: {
  groups: readonly ComparableGroup[];
  partitions: readonly NonComparablePartition[];
  numericalContradiction: boolean;
  meaningBasis: string;
  authorizedClaimCount: number;
}): string {
  return sha256Text(
    canonicalJson({
      groups: parts.groups.map((g) => ({
        key: g.comparisonKey,
        predicateId: g.predicateId,
        claimIds: [...g.claimIds].map(String).sort(),
        amounts: [...g.amounts],
        metricLabel: g.metricLabel,
      })),
      partitionReasons: parts.partitions.map((p) => p.reason).sort(),
      numericalContradiction: parts.numericalContradiction,
      winnerSelected: false,
      meaningBasis: parts.meaningBasis,
      authorizedClaimCount: parts.authorizedClaimCount,
    } as never),
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

/**
 * Comparability-before-disagreement planner (SPEC-005 / ZN-0031).
 * Partitions bookings / invoiced / received into distinct metrics; never picks a winner.
 */
export class ClaimComparer {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async compareClaims(input: CompareClaimsInput): Promise<CompareClaimsOutcome> {
    requireThat(input.meaningProfile.profileId.length > 0 && input.meaningProfile.profileId.length <= 128, 'PROFILE');
    requireThat(input.meaningProfile.knowledgeVersion > 0, 'KNOWLEDGE_VERSION');
    requireThat(/^[a-f0-9]{64}$/.test(input.meaningProfile.releaseDigest), 'RELEASE_DIGEST');

    if (input.claims.length === 0) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'EMPTY_CLAIMS' as const });
    }
    if (input.claims.length > 10_000) {
      return Object.freeze({
        tag: 'Denied' as const,
        reason: 'INVALID_CLAIM' as const,
        detail: 'CLAIM_LIMIT',
      });
    }

    for (const claim of input.claims) {
      const err = validateClaim(claim);
      if (err) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_CLAIM' as const, detail: err });
      }
    }

    const authorized = input.claims.filter((c) => c.authorized);
    const omittedUnauthorizedCount = input.claims.length - authorized.length;
    const basis = meaningBasis(input.meaningProfile);
    const built = buildGroups(authorized, input.meaningProfile);
    const resultDigest = digestResult({
      groups: built.groups,
      partitions: built.partitions,
      numericalContradiction: built.numericalContradiction,
      meaningBasis: basis,
      authorizedClaimCount: authorized.length,
    });

    return this.persist(input, {
      groups: built.groups,
      partitions: built.partitions,
      numericalContradiction: built.numericalContradiction,
      explanations: built.explanations,
      resultDigest,
      meaningBasis: basis,
      authorizedClaimCount: authorized.length,
      omittedUnauthorizedCount,
    });
  }

  private async persist(
    input: CompareClaimsInput,
    body: {
      groups: readonly ComparableGroup[];
      partitions: readonly NonComparablePartition[];
      numericalContradiction: boolean;
      explanations: readonly string[];
      resultDigest: string;
      meaningBasis: string;
      authorizedClaimCount: number;
      omittedUnauthorizedCount: number;
    },
  ): Promise<CompareClaimsOutcome> {
    const inputDigest = sha256Text(
      canonicalJson({
        claims: input.claims
          .map((c) => ({
            claimId: String(c.claimId),
            predicateId: c.predicateId,
            subjectId: String(c.subjectId),
            amount: c.amount,
            unitOrCurrency: c.unitOrCurrency,
            authorized: c.authorized,
            scope: c.scope,
            validFrom: c.validFrom,
            validUntil: c.validUntil,
          }))
          .sort((a, b) => a.claimId.localeCompare(b.claimId)),
        meaningBasis: body.meaningBasis,
      } as never),
    );

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      const existing = await sql.query<{
        run_id: string;
        result_digest: string;
        meaning_basis: string;
        payload: unknown;
      }>(
        `SELECT run_id::text, result_digest, meaning_basis, payload
         FROM ontology.comparison_runs
         WHERE world_id=$1 AND realm=$2 AND input_digest=$3 AND meaning_basis=$4 AND comparer_version=$5`,
        [input.world.worldId, input.world.realm, inputDigest, body.meaningBasis, COMPARER_IMPL],
      );

      if (existing[0]) {
        const row = existing[0];
        const payload = row.payload as {
          groups: ComparableGroup[];
          partitions: NonComparablePartition[];
          numericalContradiction: boolean;
          explanations: string[];
          authorizedClaimCount: number;
          omittedUnauthorizedCount: number;
        };
        return Object.freeze({
          tag: 'Ok' as const,
          runId: uuid(row.run_id),
          groups: Object.freeze(payload.groups),
          partitions: Object.freeze(payload.partitions),
          numericalContradiction: payload.numericalContradiction,
          winnerSelected: false as const,
          explanations: Object.freeze(payload.explanations),
          resultDigest: row.result_digest,
          meaningBasis: row.meaning_basis,
          firstRun: false,
          authorizedClaimCount: payload.authorizedClaimCount,
          omittedUnauthorizedCount: payload.omittedUnauthorizedCount,
        });
      }

      const runId = this.crypto.randomId();
      const payload = {
        groups: body.groups,
        partitions: body.partitions,
        numericalContradiction: body.numericalContradiction,
        explanations: body.explanations,
        authorizedClaimCount: body.authorizedClaimCount,
        omittedUnauthorizedCount: body.omittedUnauthorizedCount,
        winnerSelected: false,
      };

      try {
        await sql.query(
          `INSERT INTO ontology.comparison_runs(
             world_id, realm, run_id, input_digest, result_digest, meaning_basis,
             profile_id, knowledge_version, release_digest, comparer_version, payload
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [
            input.world.worldId,
            input.world.realm,
            runId,
            inputDigest,
            body.resultDigest,
            body.meaningBasis,
            input.meaningProfile.profileId,
            input.meaningProfile.knowledgeVersion,
            input.meaningProfile.releaseDigest,
            COMPARER_IMPL,
            canonicalJson(payload as never),
          ],
        );
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          return this.persist(input, body);
        }
        throw error;
      }

      return Object.freeze({
        tag: 'Ok' as const,
        runId,
        groups: Object.freeze([...body.groups]),
        partitions: Object.freeze([...body.partitions]),
        numericalContradiction: body.numericalContradiction,
        winnerSelected: false as const,
        explanations: Object.freeze([...body.explanations]),
        resultDigest: body.resultDigest,
        meaningBasis: body.meaningBasis,
        firstRun: true,
        authorizedClaimCount: body.authorizedClaimCount,
        omittedUnauthorizedCount: body.omittedUnauthorizedCount,
      });
    } finally {
      sql.release();
    }
  }
}

