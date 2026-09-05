import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';
import { compare, parseDecimal } from '../../../kernel/src/decimal.js';

export const INTERPRET_IMPL = 'interpret-v1';

export type InterpretCandidate = Readonly<{
  claimId: UUID;
  predicateId: string;
  subjectId: UUID;
  amount: string;
  unitOrCurrency: string;
  authorized: boolean;
  /** Never used as default precedence. */
  arrivalOrdinal?: number;
  modelConfidence?: number;
  userConfidence?: number;
}>;

export type PrecedenceRule = Readonly<{
  ruleId: string;
  ruleDigest: string;
  /** Claim id authorized as the selected revision when present among candidates. */
  preferredClaimId: UUID;
  /** When true, contested clears after selection; default false keeps contested. */
  resolvesContestation?: boolean;
}>;

export type InterpretBasis = Readonly<{
  releaseDigest: string;
  cutDigest: string;
  knowledgeVersion: number;
  perspective: string;
}>;

export type InterpretInput = Readonly<{
  world: WorldRef;
  queryDigest: string;
  candidates: readonly InterpretCandidate[];
  basis: InterpretBasis;
  /** Absent → unresolved when multiple comparable authorized rivals exist. */
  precedenceRule?: PrecedenceRule;
}>;

export type InterpretationStatus = 'unknown' | 'unresolved' | 'selected';

export type VerificationAxis = 'unverified' | 'rule-backed' | 'none';

export type InterpretationRecord = Readonly<{
  interpretationId: UUID;
  status: InterpretationStatus;
  verification: VerificationAxis;
  contested: boolean;
  selectedRefs: readonly UUID[];
  rivalRefs: readonly UUID[];
  dependencyRefs: readonly string[];
  queryDigest: string;
  releaseDigest: string;
  cutDigest: string;
  perspective: string;
  ruleDigest: string | null;
  resultDigest: string;
  firstRun: boolean;
}>;

export type InterpretOk = Readonly<{ tag: 'Ok'; value: InterpretationRecord }>;
export type InterpretDenied = Readonly<{
  tag: 'Denied';
  reason: 'INVALID_INPUT' | 'EMPTY_QUERY' | 'STALE_BASIS';
  detail?: string;
}>;
export type InterpretOutcome = InterpretOk | InterpretDenied;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

function amountsEqual(a: string, b: string): boolean {
  return compare(parseDecimal(a), parseDecimal(b)) === 0;
}

/**
 * Deterministic interpretation outcomes (SPEC-005 / ZN-0033).
 * Arrival order / model / user confidence never act as default precedence.
 */
export class Interpreter {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async interpret(input: InterpretInput): Promise<InterpretOutcome> {
    if (!/^[a-f0-9]{64}$/.test(input.queryDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'EMPTY_QUERY' as const, detail: 'QUERY_DIGEST' });
    }
    requireThat(/^[a-f0-9]{64}$/.test(input.basis.releaseDigest), 'RELEASE_DIGEST');
    requireThat(/^[a-f0-9]{64}$/.test(input.basis.cutDigest), 'CUT_DIGEST');
    requireThat(input.basis.knowledgeVersion > 0, 'KNOWLEDGE_VERSION');
    requireThat(input.basis.perspective.length > 0 && input.basis.perspective.length <= 128, 'PERSPECTIVE');

    if (input.candidates.length > 10_000) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'CANDIDATE_LIMIT' });
    }

    for (const c of input.candidates) {
      if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(c.amount)) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'AMOUNT' });
      }
    }

    if (input.precedenceRule) {
      const r = input.precedenceRule;
      if (!r.ruleId || r.ruleId.length > 128 || !/^[a-f0-9]{64}$/.test(r.ruleDigest)) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'RULE' });
      }
    }

    const authorized = input.candidates.filter((c) => c.authorized);
    const omitted = input.candidates.length - authorized.length;

    // Build semantic record ignoring arrival/confidence fields entirely.
    const computed = this.decide(authorized, input);
    return this.persist(input, computed, omitted);
  }

  private decide(
    authorized: readonly InterpretCandidate[],
    input: InterpretInput,
  ): Omit<InterpretationRecord, 'interpretationId' | 'firstRun'> {
    const dependencyRefs = Object.freeze([
      `release:${input.basis.releaseDigest}`,
      `cut:${input.basis.cutDigest}`,
      `kv:${input.basis.knowledgeVersion}`,
    ]);

    if (authorized.length === 0) {
      const resultDigest = sha256Text(
        canonicalJson({
          status: 'unknown',
          queryDigest: input.queryDigest,
          cutDigest: input.basis.cutDigest,
          releaseDigest: input.basis.releaseDigest,
        } as never),
      );
      return Object.freeze({
        status: 'unknown' as const,
        verification: 'none' as const,
        contested: false,
        selectedRefs: Object.freeze([]) as readonly UUID[],
        rivalRefs: Object.freeze([]) as readonly UUID[],
        dependencyRefs,
        queryDigest: input.queryDigest,
        releaseDigest: input.basis.releaseDigest,
        cutDigest: input.basis.cutDigest,
        perspective: input.basis.perspective,
        ruleDigest: null,
        resultDigest,
      });
    }

    // Stable sort by claimId only — never arrivalOrdinal / confidences.
    const sorted = [...authorized].sort((a, b) => String(a.claimId).localeCompare(String(b.claimId)));
    const amounts = new Set(sorted.map((c) => c.amount));
    const allAgree = [...amounts].every((a, _, arr) => amountsEqual(a, arr[0]!));

    if (sorted.length === 1 || allAgree) {
      const selected = sorted[0]!;
      const rivals = sorted.slice(1).map((c) => c.claimId);
      const resultDigest = sha256Text(
        canonicalJson({
          status: 'selected',
          selected: String(selected.claimId),
          rivals: rivals.map(String).sort(),
          contested: rivals.length > 0,
          queryDigest: input.queryDigest,
          cutDigest: input.basis.cutDigest,
        } as never),
      );
      return Object.freeze({
        status: 'selected' as const,
        verification: 'unverified' as const,
        contested: rivals.length > 0,
        selectedRefs: Object.freeze([selected.claimId]),
        rivalRefs: Object.freeze(rivals),
        dependencyRefs,
        queryDigest: input.queryDigest,
        releaseDigest: input.basis.releaseDigest,
        cutDigest: input.basis.cutDigest,
        perspective: input.basis.perspective,
        ruleDigest: null,
        resultDigest,
      });
    }

    // Multiple comparable rivals with disagreeing values
    const rule = input.precedenceRule;
    if (!rule) {
      const rivalRefs = Object.freeze(sorted.map((c) => c.claimId));
      const resultDigest = sha256Text(
        canonicalJson({
          status: 'unresolved',
          rivals: rivalRefs.map(String).sort(),
          queryDigest: input.queryDigest,
          cutDigest: input.basis.cutDigest,
          ruleDigest: null,
        } as never),
      );
      return Object.freeze({
        status: 'unresolved' as const,
        verification: 'unverified' as const,
        contested: true,
        selectedRefs: Object.freeze([]) as readonly UUID[],
        rivalRefs,
        dependencyRefs,
        queryDigest: input.queryDigest,
        releaseDigest: input.basis.releaseDigest,
        cutDigest: input.basis.cutDigest,
        perspective: input.basis.perspective,
        ruleDigest: null,
        resultDigest,
      });
    }

    const preferred = sorted.find((c) => String(c.claimId) === String(rule.preferredClaimId));
    if (!preferred) {
      // Rule points at absent claim → still unresolved (do not invent)
      const rivalRefs = Object.freeze(sorted.map((c) => c.claimId));
      const resultDigest = sha256Text(
        canonicalJson({
          status: 'unresolved',
          rivals: rivalRefs.map(String).sort(),
          queryDigest: input.queryDigest,
          cutDigest: input.basis.cutDigest,
          ruleDigest: rule.ruleDigest,
          preferredMissing: true,
        } as never),
      );
      return Object.freeze({
        status: 'unresolved' as const,
        verification: 'rule-backed' as const,
        contested: true,
        selectedRefs: Object.freeze([]) as readonly UUID[],
        rivalRefs,
        dependencyRefs,
        queryDigest: input.queryDigest,
        releaseDigest: input.basis.releaseDigest,
        cutDigest: input.basis.cutDigest,
        perspective: input.basis.perspective,
        ruleDigest: rule.ruleDigest,
        resultDigest,
      });
    }

    const rivals = sorted.filter((c) => String(c.claimId) !== String(preferred.claimId)).map((c) => c.claimId);
    const contested = rule.resolvesContestation === true ? false : rivals.length > 0;
    const resultDigest = sha256Text(
      canonicalJson({
        status: 'selected',
        selected: String(preferred.claimId),
        rivals: rivals.map(String).sort(),
        contested,
        queryDigest: input.queryDigest,
        cutDigest: input.basis.cutDigest,
        ruleDigest: rule.ruleDigest,
      } as never),
    );
    return Object.freeze({
      status: 'selected' as const,
      verification: 'rule-backed' as const,
      contested,
      selectedRefs: Object.freeze([preferred.claimId]),
      rivalRefs: Object.freeze(rivals),
      dependencyRefs,
      queryDigest: input.queryDigest,
      releaseDigest: input.basis.releaseDigest,
      cutDigest: input.basis.cutDigest,
      perspective: input.basis.perspective,
      ruleDigest: rule.ruleDigest,
      resultDigest,
    });
  }

  private async persist(
    input: InterpretInput,
    body: Omit<InterpretationRecord, 'interpretationId' | 'firstRun'>,
    omittedUnauthorized: number,
  ): Promise<InterpretOutcome> {
    const inputDigest = sha256Text(
      canonicalJson({
        queryDigest: input.queryDigest,
        cutDigest: input.basis.cutDigest,
        releaseDigest: input.basis.releaseDigest,
        knowledgeVersion: input.basis.knowledgeVersion,
        perspective: input.basis.perspective,
        ruleDigest: input.precedenceRule?.ruleDigest ?? null,
        preferredClaimId: input.precedenceRule ? String(input.precedenceRule.preferredClaimId) : null,
        resolvesContestation: input.precedenceRule?.resolvesContestation ?? false,
        // Authorized candidates only; order by claimId — ignore arrival/confidence
        candidates: input.candidates
          .filter((c) => c.authorized)
          .map((c) => ({
            claimId: String(c.claimId),
            predicateId: c.predicateId,
            subjectId: String(c.subjectId),
            amount: c.amount,
            unitOrCurrency: c.unitOrCurrency,
          }))
          .sort((a, b) => a.claimId.localeCompare(b.claimId)),
        omittedUnauthorized,
        impl: INTERPRET_IMPL,
      } as never),
    );

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      const existing = await sql.query<{
        interpretation_id: string;
        status: string;
        verification: string;
        contested: boolean;
        selected_refs: string[];
        rival_refs: string[];
        dependency_refs: string[];
        query_digest: string;
        release_digest: string;
        cut_digest: string;
        perspective: string;
        rule_digest: string | null;
        result_digest: string;
      }>(
        `SELECT interpretation_id::text, status, verification, contested,
                selected_refs::text[], rival_refs::text[], dependency_refs,
                query_digest, release_digest, cut_digest, perspective, rule_digest, result_digest
         FROM ontology.interpretations
         WHERE world_id=$1 AND realm=$2 AND input_digest=$3 AND interpreter_version=$4`,
        [input.world.worldId, input.world.realm, inputDigest, INTERPRET_IMPL],
      );

      if (existing[0]) {
        const row = existing[0];
        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            interpretationId: uuid(row.interpretation_id),
            status: row.status as InterpretationStatus,
            verification: row.verification as VerificationAxis,
            contested: row.contested,
            selectedRefs: Object.freeze(row.selected_refs.map((id) => uuid(id))),
            rivalRefs: Object.freeze(row.rival_refs.map((id) => uuid(id))),
            dependencyRefs: Object.freeze(row.dependency_refs),
            queryDigest: row.query_digest,
            releaseDigest: row.release_digest,
            cutDigest: row.cut_digest,
            perspective: row.perspective,
            ruleDigest: row.rule_digest,
            resultDigest: row.result_digest,
            firstRun: false,
          }),
        });
      }

      const interpretationId = this.crypto.randomId();
      try {
        await sql.query(
          `INSERT INTO ontology.interpretations(
             world_id, realm, interpretation_id, input_digest, query_digest, release_digest, cut_digest,
             perspective, status, verification, contested, selected_refs, rival_refs, dependency_refs,
             rule_digest, result_digest, interpreter_version
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid[],$13::uuid[],$14,$15,$16,$17
           )`,
          [
            input.world.worldId,
            input.world.realm,
            interpretationId,
            inputDigest,
            body.queryDigest,
            body.releaseDigest,
            body.cutDigest,
            body.perspective,
            body.status,
            body.verification,
            body.contested,
            body.selectedRefs,
            body.rivalRefs,
            body.dependencyRefs,
            body.ruleDigest,
            body.resultDigest,
            INTERPRET_IMPL,
          ],
        );
      } catch (error: unknown) {
        if (isUniqueViolation(error)) return this.persist(input, body, omittedUnauthorized);
        throw error;
      }

      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          interpretationId,
          ...body,
          firstRun: true,
        }),
      });
    } finally {
      sql.release();
    }
  }
}
