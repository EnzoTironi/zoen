import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';

export const CORRECTION_IMPL = 'scoped-correction-v1';

export type AnswerKind = 'assertion' | 'identity-decision' | 'retraction';

export type CaseGuards = Readonly<{
  caseId: string;
  /** Expected question digest — must match exactly. */
  questionDigest: string;
  /** Authority principal that may reply. */
  authorityPrincipalId: UUID;
  /** Exact subject/order scope this reply may touch. */
  scopedSubjectId: UUID;
  validFrom: string;
  validUntil: string | null;
  /** Cut at which the question was asked; stale if basis moved. */
  cutDigest: string;
}>;

export type ApplyCorrectionInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  guards: CaseGuards;
  actorId: UUID;
  answerKind: AnswerKind;
  /** Target claim being corrected (e.g. quantity=80). */
  targetClaimId: UUID;
  /** Successor claim value (e.g. quantity=100) as opaque canonical JSON text. */
  successorValue: string;
  evidenceRefs: readonly string[];
  /** Must be false — human reply never installs a reusable RuleDefinition. */
  installRule?: boolean;
}>;

export type RetractCorrectionInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  guards: CaseGuards;
  actorId: UUID;
  /** Correction receipt to retract (must belong to same case/scope). */
  correctionId: UUID;
}>;

export type CorrectionReceipt = Readonly<{
  correctionId: UUID;
  targetClaimId: UUID;
  successorClaimId: UUID | null;
  actorId: UUID;
  caseId: string;
  questionDigest: string;
  answerKind: AnswerKind;
  cutDigest: string;
  scopedSubjectId: UUID;
  validFrom: string;
  validUntil: string | null;
  evidenceRefs: readonly string[];
  /** Always false — no RuleDefinition created. */
  ruleCreated: false;
  retracted: boolean;
  retractsCorrectionId: string | null;
  resultDigest: string;
  firstRun: boolean;
}>;

export type CorrectionOk = Readonly<{ tag: 'Ok'; value: CorrectionReceipt }>;
export type CorrectionStale = Readonly<{ tag: 'Stale'; reason: 'CUT_MISMATCH' | 'QUESTION_MISMATCH' | 'ALREADY_RETRACTED' }>;
export type CorrectionDenied = Readonly<{
  tag: 'Denied';
  reason:
    | 'AUTHORITY_MISMATCH'
    | 'SCOPE_MISMATCH'
    | 'INVALID_INPUT'
    | 'RULE_INSTALL_FORBIDDEN'
    | 'NOT_FOUND'
    | 'FORBIDDEN_RIVAL';
  detail?: string;
}>;
export type CorrectionOutcome = CorrectionOk | CorrectionStale | CorrectionDenied;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

/**
 * Human correction with exact scope and undo (SPEC-005 / ZN-0034).
 * Appends attributed assertions; undo via retraction receipt — never deletes prior reply
 * and never installs a reusable RuleDefinition.
 */
export class CorrectionService {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async applyCorrection(input: ApplyCorrectionInput): Promise<CorrectionOutcome> {
    const g = input.guards;
    if (!/^[a-f0-9]{64}$/.test(g.questionDigest) || !/^[a-f0-9]{64}$/.test(g.cutDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'DIGEST' });
    }
    if (!g.caseId || g.caseId.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'CASE' });
    }
    if (input.answerKind !== 'assertion' && input.answerKind !== 'identity-decision') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'ANSWER_KIND' });
    }
    if (input.installRule === true) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'RULE_INSTALL_FORBIDDEN' as const });
    }
    if (String(input.actorId) !== String(g.authorityPrincipalId)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'AUTHORITY_MISMATCH' as const });
    }
    if (!input.successorValue || input.successorValue.length > 4096) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'VALUE' });
    }

    const successorClaimId = this.crypto.randomId();
    const body = {
      targetClaimId: input.targetClaimId,
      successorClaimId,
      actorId: input.actorId,
      caseId: g.caseId,
      questionDigest: g.questionDigest,
      answerKind: input.answerKind,
      cutDigest: g.cutDigest,
      scopedSubjectId: g.scopedSubjectId,
      validFrom: g.validFrom,
      validUntil: g.validUntil,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      ruleCreated: false as const,
      retracted: false,
      retractsCorrectionId: null as string | null,
      successorValue: input.successorValue,
    };
    return this.persistApply(input, body);
  }

  async retractCorrection(input: RetractCorrectionInput): Promise<CorrectionOutcome> {
    const g = input.guards;
    if (!/^[a-f0-9]{64}$/.test(g.questionDigest) || !/^[a-f0-9]{64}$/.test(g.cutDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'DIGEST' });
    }
    if (String(input.actorId) !== String(g.authorityPrincipalId)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'AUTHORITY_MISMATCH' as const });
    }

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      const existing = await sql.query<{
        correction_id: string;
        target_claim_id: string;
        successor_claim_id: string | null;
        actor_id: string;
        case_id: string;
        question_digest: string;
        answer_kind: string;
        cut_digest: string;
        scoped_subject_id: string;
        valid_from: string;
        valid_until: string | null;
        evidence_refs: string[];
        retracted: boolean;
        result_digest: string;
      }>(
        `SELECT correction_id::text, target_claim_id::text, successor_claim_id::text, actor_id::text,
                case_id, question_digest, answer_kind, cut_digest, scoped_subject_id::text,
                valid_from, valid_until, evidence_refs, retracted, result_digest
         FROM ontology.corrections
         WHERE world_id=$1 AND realm=$2 AND correction_id=$3`,
        [input.world.worldId, input.world.realm, input.correctionId],
      );

      if (!existing[0]) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND' as const });
      }
      const row = existing[0];
      if (row.case_id !== g.caseId) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'SCOPE_MISMATCH' as const, detail: 'CASE' });
      }
      if (row.question_digest !== g.questionDigest) {
        return Object.freeze({ tag: 'Stale' as const, reason: 'QUESTION_MISMATCH' as const });
      }
      if (String(row.scoped_subject_id) !== String(g.scopedSubjectId)) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'SCOPE_MISMATCH' as const, detail: 'SUBJECT' });
      }
      if (row.retracted) {
        return Object.freeze({ tag: 'Stale' as const, reason: 'ALREADY_RETRACTED' as const });
      }

      // Append retraction receipt (do not delete the earlier reply)
      const retractId = this.crypto.randomId();
      const resultDigest = sha256Text(
        canonicalJson({
          kind: 'retraction',
          retracts: row.correction_id,
          caseId: g.caseId,
          questionDigest: g.questionDigest,
          cutDigest: g.cutDigest,
          actorId: String(input.actorId),
          operationId: String(input.operationId),
          impl: CORRECTION_IMPL,
        } as never),
      );

      const opDigest = sha256Text(
        canonicalJson({
          op: 'retract',
          operationId: String(input.operationId),
          correctionId: String(input.correctionId),
          impl: CORRECTION_IMPL,
        } as never),
      );

      const priorOp = await sql.query<{ correction_id: string; result_digest: string; answer_kind: string; retracted: boolean; retracts_correction_id: string | null; target_claim_id: string; successor_claim_id: string | null; actor_id: string; case_id: string; question_digest: string; cut_digest: string; scoped_subject_id: string; valid_from: string; valid_until: string | null; evidence_refs: string[] }>(
        `SELECT correction_id::text, result_digest, answer_kind, retracted, retracts_correction_id::text,
                target_claim_id::text, successor_claim_id::text, actor_id::text, case_id, question_digest,
                cut_digest, scoped_subject_id::text, valid_from, valid_until, evidence_refs
         FROM ontology.corrections
         WHERE world_id=$1 AND realm=$2 AND operation_digest=$3`,
        [input.world.worldId, input.world.realm, opDigest],
      );
      if (priorOp[0]) {
        const p = priorOp[0];
        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            correctionId: uuid(p.correction_id),
            targetClaimId: uuid(p.target_claim_id),
            successorClaimId: p.successor_claim_id ? uuid(p.successor_claim_id) : null,
            actorId: uuid(p.actor_id),
            caseId: p.case_id,
            questionDigest: p.question_digest,
            answerKind: p.answer_kind as AnswerKind,
            cutDigest: p.cut_digest,
            scopedSubjectId: uuid(p.scoped_subject_id),
            validFrom: p.valid_from,
            validUntil: p.valid_until,
            evidenceRefs: Object.freeze(p.evidence_refs),
            ruleCreated: false as const,
            retracted: true,
            retractsCorrectionId: p.retracts_correction_id,
            resultDigest: p.result_digest,
            firstRun: false,
          }),
        });
      }

      try {
        await sql.query('BEGIN');
        await sql.query(
          `UPDATE ontology.corrections SET retracted=true
           WHERE world_id=$1 AND realm=$2 AND correction_id=$3 AND retracted=false`,
          [input.world.worldId, input.world.realm, input.correctionId],
        );
        await sql.query(
          `INSERT INTO ontology.corrections(
             world_id, realm, correction_id, operation_digest, target_claim_id, successor_claim_id,
             actor_id, case_id, question_digest, answer_kind, cut_digest, scoped_subject_id,
             valid_from, valid_until, evidence_refs, successor_value, rule_created, retracted,
             retracts_correction_id, result_digest, correction_version
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,'retraction',$10,$11,$12,$13,$14,NULL,false,true,$15,$16,$17
           )`,
          [
            input.world.worldId,
            input.world.realm,
            retractId,
            opDigest,
            row.target_claim_id,
            row.successor_claim_id,
            input.actorId,
            g.caseId,
            g.questionDigest,
            g.cutDigest,
            g.scopedSubjectId,
            g.validFrom,
            g.validUntil,
            row.evidence_refs,
            row.correction_id,
            resultDigest,
            CORRECTION_IMPL,
          ],
        );
        await sql.query('COMMIT');
      } catch (error: unknown) {
        await sql.query('ROLLBACK');
        if (isUniqueViolation(error)) return this.retractCorrection(input);
        throw error;
      }

      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          correctionId: retractId,
          targetClaimId: uuid(row.target_claim_id),
          successorClaimId: row.successor_claim_id ? uuid(row.successor_claim_id) : null,
          actorId: input.actorId,
          caseId: g.caseId,
          questionDigest: g.questionDigest,
          answerKind: 'retraction' as const,
          cutDigest: g.cutDigest,
          scopedSubjectId: g.scopedSubjectId,
          validFrom: g.validFrom,
          validUntil: g.validUntil,
          evidenceRefs: Object.freeze(row.evidence_refs),
          ruleCreated: false as const,
          retracted: true,
          retractsCorrectionId: row.correction_id,
          resultDigest,
          firstRun: true,
        }),
      });
    } finally {
      sql.release();
    }
  }

  /** Replay interpretation view at a prior cut: active correction for scope at that cut, if any. */
  async activeCorrectionAtCut(
    world: WorldRef,
    scopedSubjectId: UUID,
    cutDigest: string,
  ): Promise<CorrectionReceipt | null> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        world.worldId,
        world.realm,
      ]);
      const rows = await sql.query<{
        correction_id: string;
        target_claim_id: string;
        successor_claim_id: string | null;
        actor_id: string;
        case_id: string;
        question_digest: string;
        answer_kind: string;
        cut_digest: string;
        scoped_subject_id: string;
        valid_from: string;
        valid_until: string | null;
        evidence_refs: string[];
        retracted: boolean;
        retracts_correction_id: string | null;
        result_digest: string;
      }>(
        `SELECT correction_id::text, target_claim_id::text, successor_claim_id::text, actor_id::text,
                case_id, question_digest, answer_kind, cut_digest, scoped_subject_id::text,
                valid_from, valid_until, evidence_refs, retracted, retracts_correction_id::text, result_digest
         FROM ontology.corrections
         WHERE world_id=$1 AND realm=$2 AND scoped_subject_id=$3 AND cut_digest=$4
           AND answer_kind IN ('assertion','identity-decision')
         ORDER BY created_at DESC`,
        [world.worldId, world.realm, scopedSubjectId, cutDigest],
      );
      for (const row of rows) {
        if (row.retracted) continue;
        return Object.freeze({
          correctionId: uuid(row.correction_id),
          targetClaimId: uuid(row.target_claim_id),
          successorClaimId: row.successor_claim_id ? uuid(row.successor_claim_id) : null,
          actorId: uuid(row.actor_id),
          caseId: row.case_id,
          questionDigest: row.question_digest,
          answerKind: row.answer_kind as AnswerKind,
          cutDigest: row.cut_digest,
          scopedSubjectId: uuid(row.scoped_subject_id),
          validFrom: row.valid_from,
          validUntil: row.valid_until,
          evidenceRefs: Object.freeze(row.evidence_refs),
          ruleCreated: false as const,
          retracted: false,
          retractsCorrectionId: row.retracts_correction_id,
          resultDigest: row.result_digest,
          firstRun: false,
        });
      }
      return null;
    } finally {
      sql.release();
    }
  }

  private async persistApply(
    input: ApplyCorrectionInput,
    body: {
      targetClaimId: UUID;
      successorClaimId: UUID;
      actorId: UUID;
      caseId: string;
      questionDigest: string;
      answerKind: AnswerKind;
      cutDigest: string;
      scopedSubjectId: UUID;
      validFrom: string;
      validUntil: string | null;
      evidenceRefs: readonly string[];
      ruleCreated: false;
      retracted: boolean;
      retractsCorrectionId: string | null;
      successorValue: string;
    },
  ): Promise<CorrectionOutcome> {
    const opDigest = sha256Text(
      canonicalJson({
        op: 'apply',
        operationId: String(input.operationId),
        caseId: body.caseId,
        questionDigest: body.questionDigest,
        targetClaimId: String(body.targetClaimId),
        successorValue: body.successorValue,
        cutDigest: body.cutDigest,
        impl: CORRECTION_IMPL,
      } as never),
    );
    const resultDigest = sha256Text(
      canonicalJson({
        kind: body.answerKind,
        target: String(body.targetClaimId),
        successor: String(body.successorClaimId),
        value: body.successorValue,
        caseId: body.caseId,
        questionDigest: body.questionDigest,
        cutDigest: body.cutDigest,
        scope: String(body.scopedSubjectId),
        ruleCreated: false,
        impl: CORRECTION_IMPL,
      } as never),
    );

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      const existing = await sql.query<{
        correction_id: string;
        target_claim_id: string;
        successor_claim_id: string | null;
        actor_id: string;
        case_id: string;
        question_digest: string;
        answer_kind: string;
        cut_digest: string;
        scoped_subject_id: string;
        valid_from: string;
        valid_until: string | null;
        evidence_refs: string[];
        retracted: boolean;
        retracts_correction_id: string | null;
        result_digest: string;
      }>(
        `SELECT correction_id::text, target_claim_id::text, successor_claim_id::text, actor_id::text,
                case_id, question_digest, answer_kind, cut_digest, scoped_subject_id::text,
                valid_from, valid_until, evidence_refs, retracted, retracts_correction_id::text, result_digest
         FROM ontology.corrections
         WHERE world_id=$1 AND realm=$2 AND operation_digest=$3`,
        [input.world.worldId, input.world.realm, opDigest],
      );
      if (existing[0]) {
        const row = existing[0];
        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            correctionId: uuid(row.correction_id),
            targetClaimId: uuid(row.target_claim_id),
            successorClaimId: row.successor_claim_id ? uuid(row.successor_claim_id) : null,
            actorId: uuid(row.actor_id),
            caseId: row.case_id,
            questionDigest: row.question_digest,
            answerKind: row.answer_kind as AnswerKind,
            cutDigest: row.cut_digest,
            scopedSubjectId: uuid(row.scoped_subject_id),
            validFrom: row.valid_from,
            validUntil: row.valid_until,
            evidenceRefs: Object.freeze(row.evidence_refs),
            ruleCreated: false as const,
            retracted: row.retracted,
            retractsCorrectionId: row.retracts_correction_id,
            resultDigest: row.result_digest,
            firstRun: false,
          }),
        });
      }

      const correctionId = this.crypto.randomId();
      try {
        await sql.query(
          `INSERT INTO ontology.corrections(
             world_id, realm, correction_id, operation_digest, target_claim_id, successor_claim_id,
             actor_id, case_id, question_digest, answer_kind, cut_digest, scoped_subject_id,
             valid_from, valid_until, evidence_refs, successor_value, rule_created, retracted,
             retracts_correction_id, result_digest, correction_version
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,false,NULL,$17,$18
           )`,
          [
            input.world.worldId,
            input.world.realm,
            correctionId,
            opDigest,
            body.targetClaimId,
            body.successorClaimId,
            body.actorId,
            body.caseId,
            body.questionDigest,
            body.answerKind,
            body.cutDigest,
            body.scopedSubjectId,
            body.validFrom,
            body.validUntil,
            body.evidenceRefs,
            body.successorValue,
            resultDigest,
            CORRECTION_IMPL,
          ],
        );
      } catch (error: unknown) {
        if (isUniqueViolation(error)) return this.persistApply(input, body);
        throw error;
      }

      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          correctionId,
          targetClaimId: body.targetClaimId,
          successorClaimId: body.successorClaimId,
          actorId: body.actorId,
          caseId: body.caseId,
          questionDigest: body.questionDigest,
          answerKind: body.answerKind,
          cutDigest: body.cutDigest,
          scopedSubjectId: body.scopedSubjectId,
          validFrom: body.validFrom,
          validUntil: body.validUntil,
          evidenceRefs: body.evidenceRefs,
          ruleCreated: false as const,
          retracted: false,
          retractsCorrectionId: null,
          resultDigest,
          firstRun: true,
        }),
      });
    } finally {
      sql.release();
    }
  }
}
