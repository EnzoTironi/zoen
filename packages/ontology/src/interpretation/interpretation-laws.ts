import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import {
  Interpreter,
  type InterpretCandidate,
  type InterpretBasis,
  type InterpretationRecord,
  type PrecedenceRule,
} from './interpret.js';

export const LAWS_IMPL = 'interpretation-laws-v1';

export type DeclassificationRule = Readonly<{
  /** Must be true — only a released rule may authorize observable difference. */
  released: true;
  ruleDigest: string;
}>;

export type VisibleEquivalenceInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  queryDigest: string;
  basis: InterpretBasis;
  /** Authorized-only world view. */
  authorizedCandidates: readonly InterpretCandidate[];
  /** Otherwise identical set that also contains forbidden (authorized=false) rivals. */
  withHiddenRivalCandidates: readonly InterpretCandidate[];
  precedenceRule?: PrecedenceRule;
  declassificationRule?: DeclassificationRule;
}>;

export type CutReplayInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  queryDigest: string;
  candidates: readonly InterpretCandidate[];
  basisAtCut: InterpretBasis;
  /** Replay at a different cut — must yield Stale/unsupported when expectedCut mismatches. */
  replayCutDigest: string;
  expectedCutDigest: string;
  precedenceRule?: PrecedenceRule;
}>;

export type ObservableProjection = Readonly<{
  status: string;
  verification: string;
  contested: boolean;
  selectedRefs: readonly string[];
  rivalRefs: readonly string[];
  confidenceWording: string;
  explanation: string;
  cutDigest: string;
  perspective: string;
}>;

export type LawsProof = Readonly<{
  proofId: UUID;
  kind: 'visible-equivalence' | 'cut-replay';
  equivalent: boolean;
  declassified: boolean;
  leakDetected: boolean;
  hiddenRivalIds: readonly string[];
  observableDigestA: string;
  observableDigestB: string;
  resultDigest: string;
  firstRun: boolean;
  projectionA: ObservableProjection;
  projectionB: ObservableProjection | null;
}>;

export type LawsOk = Readonly<{ tag: 'Ok'; value: LawsProof }>;
export type LawsStale = Readonly<{ tag: 'Stale'; reason: 'CUT_MISMATCH' }>;
export type LawsDenied = Readonly<{
  tag: 'Denied';
  reason: 'INVALID_INPUT' | 'LEAK' | 'PAIR_MISMATCH' | 'DECLASSIFICATION_INVALID';
  detail?: string;
}>;
export type LawsOutcome = LawsOk | LawsStale | LawsDenied;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

function projectObservable(record: InterpretationRecord): ObservableProjection {
  const selected = [...record.selectedRefs].map(String).sort();
  const rivals = [...record.rivalRefs].map(String).sort();
  const confidenceWording =
    record.status === 'selected'
      ? `selected:${selected.length}`
      : record.status === 'unresolved'
        ? `unresolved:${selected.length + rivals.length}`
        : 'unknown:0';
  const explanation = `${record.status}|contested=${record.contested}|verification=${record.verification}|${confidenceWording}`;
  return Object.freeze({
    status: record.status,
    verification: record.verification,
    contested: record.contested,
    selectedRefs: Object.freeze(selected),
    rivalRefs: Object.freeze(rivals),
    confidenceWording,
    explanation,
    cutDigest: record.cutDigest,
    perspective: record.perspective,
  });
}

function containsLeak(text: string, hiddenIds: readonly string[], hiddenAmounts: readonly string[]): boolean {
  for (const id of hiddenIds) {
    if (id && text.includes(id)) return true;
  }
  for (const amount of hiddenAmounts) {
    if (amount && text.includes(amount)) return true;
  }
  return false;
}

/**
 * Point-in-time and visible-perspective reconciliation laws (SPEC-005 / ZN-0036).
 * Proves observational equivalence across paired views and cut replay against
 * retained evidence; rejects hidden rivals from permitted payloads.
 */
export class InterpretationLaws {
  private readonly interpreter: Interpreter;

  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
    interpreter?: Interpreter,
  ) {
    this.interpreter = interpreter ?? new Interpreter(db, crypto);
  }

  async proveVisibleEquivalence(input: VisibleEquivalenceInput): Promise<LawsOutcome> {
    if (!/^[a-f0-9]{64}$/.test(input.queryDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'QUERY' });
    }
    if (input.declassificationRule) {
      if (input.declassificationRule.released !== true || !/^[a-f0-9]{64}$/.test(input.declassificationRule.ruleDigest)) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'DECLASSIFICATION_INVALID' as const });
      }
    }

    const authOnly = input.authorizedCandidates;
    const withHidden = input.withHiddenRivalCandidates;
    if (authOnly.some((c) => !c.authorized)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'AUTH_SET' });
    }
    const hidden = withHidden.filter((c) => !c.authorized);
    if (hidden.length === 0) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'MISSING_HIDDEN' });
    }
    // Authorized subset of the hidden-rival world must match the authorized-only set by claim id+amount.
    const authFromPair = withHidden.filter((c) => c.authorized);
    const key = (c: InterpretCandidate) => `${String(c.claimId)}|${c.amount}|${c.predicateId}`;
    const setA = new Set(authOnly.map(key));
    const setB = new Set(authFromPair.map(key));
    if (setA.size !== setB.size || [...setA].some((k) => !setB.has(k))) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'AUTHORIZED_DIVERGE' });
    }

    const hiddenIds = Object.freeze(hidden.map((c) => String(c.claimId)));
    const hiddenAmounts = Object.freeze(hidden.map((c) => c.amount));

    const opDigest = sha256Text(
      canonicalJson({
        op: 'visible-equivalence',
        operationId: String(input.operationId),
        queryDigest: input.queryDigest,
        basis: input.basis,
        authKeys: [...setA].sort(),
        hiddenIds,
        declass: input.declassificationRule?.ruleDigest ?? null,
        impl: LAWS_IMPL,
      } as never),
    );

    const prior = await this.loadProof(input.world, opDigest);
    if (prior) return prior;

    const left = await this.interpreter.interpret({
      world: input.world,
      queryDigest: input.queryDigest,
      candidates: authOnly,
      basis: input.basis,
      precedenceRule: input.precedenceRule,
    });
    const right = await this.interpreter.interpret({
      world: input.world,
      queryDigest: input.queryDigest,
      candidates: withHidden,
      basis: input.basis,
      precedenceRule: input.precedenceRule,
    });
    if (left.tag !== 'Ok' || right.tag !== 'Ok') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'INTERPRET' });
    }

    const projA = projectObservable(left.value);
    const projB = projectObservable(right.value);
    const digestA = sha256Text(canonicalJson(projA as never));
    const digestB = sha256Text(canonicalJson(projB as never));

    const payloadB = JSON.stringify(projB);
    const leakDetected =
      containsLeak(payloadB, hiddenIds, hiddenAmounts) ||
      containsLeak(JSON.stringify(right.value), hiddenIds, hiddenAmounts) ||
      projB.rivalRefs.some((id) => hiddenIds.includes(id)) ||
      projB.selectedRefs.some((id) => hiddenIds.includes(id));

    if (leakDetected) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'LEAK' as const, detail: 'HIDDEN_RIVAL' });
    }

    const equivalent = digestA === digestB;
    const declassified = Boolean(input.declassificationRule);
    if (!equivalent && !declassified) {
      // Without released declassification, divergence is a denial (law violated).
      return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'NOT_EQUIVALENT' });
    }

    const proofId = this.crypto.randomId();
    const resultDigest = sha256Text(
      canonicalJson({
        kind: 'visible-equivalence',
        digestA,
        digestB,
        equivalent,
        declassified,
        hiddenIds,
        leakDetected: false,
        impl: LAWS_IMPL,
      } as never),
    );

    const inserted = await this.persistProof({
      world: input.world,
      proofId,
      operationDigest: opDigest,
      kind: 'visible-equivalence',
      queryDigest: input.queryDigest,
      cutA: input.basis.cutDigest,
      cutB: input.basis.cutDigest,
      perspective: input.basis.perspective,
      digestA,
      digestB,
      equivalent,
      declassified,
      declassRule: input.declassificationRule?.ruleDigest ?? null,
      hiddenIds,
      leakDetected: false,
      resultDigest,
    });
    if (!inserted) {
      const raced = await this.loadProof(input.world, opDigest);
      if (raced) return raced;
    }

    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({
        proofId,
        kind: 'visible-equivalence' as const,
        equivalent,
        declassified,
        leakDetected: false,
        hiddenRivalIds: hiddenIds,
        observableDigestA: digestA,
        observableDigestB: digestB,
        resultDigest,
        firstRun: true,
        projectionA: projA,
        projectionB: projB,
      }),
    });
  }

  async replayCuts(input: CutReplayInput): Promise<LawsOutcome> {
    if (!/^[a-f0-9]{64}$/.test(input.queryDigest) || !/^[a-f0-9]{64}$/.test(input.replayCutDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'DIGEST' });
    }
    if (input.expectedCutDigest !== input.basisAtCut.cutDigest) {
      return Object.freeze({ tag: 'Stale' as const, reason: 'CUT_MISMATCH' as const });
    }

    const opDigest = sha256Text(
      canonicalJson({
        op: 'cut-replay',
        operationId: String(input.operationId),
        queryDigest: input.queryDigest,
        cut: input.basisAtCut.cutDigest,
        replayCut: input.replayCutDigest,
        impl: LAWS_IMPL,
      } as never),
    );
    const prior = await this.loadProof(input.world, opDigest);
    if (prior) return prior;

    const atCut = await this.interpreter.interpret({
      world: input.world,
      queryDigest: input.queryDigest,
      candidates: input.candidates,
      basis: input.basisAtCut,
      precedenceRule: input.precedenceRule,
    });
    if (atCut.tag !== 'Ok') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'INTERPRET' });
    }
    const projA = projectObservable(atCut.value);
    const digestA = sha256Text(canonicalJson(projA as never));

    // Same basis again → deterministic same observable digest
    const again = await this.interpreter.interpret({
      world: input.world,
      queryDigest: input.queryDigest,
      candidates: input.candidates,
      basis: input.basisAtCut,
      precedenceRule: input.precedenceRule,
    });
    if (again.tag !== 'Ok') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'REPLAY' });
    }
    const projAgain = projectObservable(again.value);
    const digestAgain = sha256Text(canonicalJson(projAgain as never));
    if (digestA !== digestAgain || String(atCut.value.interpretationId) !== String(again.value.interpretationId)) {
      // Content identity should replay; firstRun may differ
      if (digestA !== digestAgain) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'NONDETERMINISTIC' });
      }
    }

    // Changed cut basis: interpret with new cut — observable cutDigest changes (explicit different basis)
    const changedBasis: InterpretBasis = Object.freeze({
      ...input.basisAtCut,
      cutDigest: input.replayCutDigest,
    });
    const changed = await this.interpreter.interpret({
      world: input.world,
      queryDigest: input.queryDigest,
      candidates: input.candidates,
      basis: changedBasis,
      precedenceRule: input.precedenceRule,
    });
    if (changed.tag !== 'Ok') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'CHANGED' });
    }
    const projB = projectObservable(changed.value);
    const digestB = sha256Text(canonicalJson(projB as never));
    // Different cuts must not silently share the same cut-bound observable projection
    if (input.replayCutDigest !== input.basisAtCut.cutDigest && digestA === digestB && projA.cutDigest === projB.cutDigest) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'PAIR_MISMATCH' as const, detail: 'CUT_NOT_DISTINGUISHED' });
    }

    const proofId = this.crypto.randomId();
    const resultDigest = sha256Text(
      canonicalJson({ kind: 'cut-replay', digestA, digestB, impl: LAWS_IMPL } as never),
    );
    const inserted = await this.persistProof({
      world: input.world,
      proofId,
      operationDigest: opDigest,
      kind: 'cut-replay',
      queryDigest: input.queryDigest,
      cutA: input.basisAtCut.cutDigest,
      cutB: input.replayCutDigest,
      perspective: input.basisAtCut.perspective,
      digestA,
      digestB,
      equivalent: digestA === digestB,
      declassified: false,
      declassRule: null,
      hiddenIds: [],
      leakDetected: false,
      resultDigest,
    });
    if (!inserted) {
      const raced = await this.loadProof(input.world, opDigest);
      if (raced) return raced;
    }

    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({
        proofId,
        kind: 'cut-replay' as const,
        equivalent: digestA === digestB,
        declassified: false,
        leakDetected: false,
        hiddenRivalIds: Object.freeze([]) as readonly string[],
        observableDigestA: digestA,
        observableDigestB: digestB,
        resultDigest,
        firstRun: true,
        projectionA: projA,
        projectionB: projB,
      }),
    });
  }

  private async loadProof(world: WorldRef, operationDigest: string): Promise<LawsOk | null> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        world.worldId,
        world.realm,
      ]);
      const rows = await sql.query<{
        proof_id: string;
        kind: 'visible-equivalence' | 'cut-replay';
        equivalent: boolean;
        declassified: boolean;
        leak_detected: boolean;
        hidden_rival_ids: string[];
        observable_digest_a: string;
        observable_digest_b: string;
        result_digest: string;
        cut_digest_a: string;
        perspective: string;
      }>(
        `SELECT proof_id::text, kind, equivalent, declassified, leak_detected, hidden_rival_ids,
                observable_digest_a, observable_digest_b, result_digest, cut_digest_a, perspective
         FROM ontology.interpretation_law_proofs
         WHERE world_id=$1 AND realm=$2 AND operation_digest=$3`,
        [world.worldId, world.realm, operationDigest],
      );
      if (!rows[0]) return null;
      const r = rows[0];
      const stubProj: ObservableProjection = Object.freeze({
        status: 'replay',
        verification: 'none',
        contested: false,
        selectedRefs: Object.freeze([]) as readonly string[],
        rivalRefs: Object.freeze([]) as readonly string[],
        confidenceWording: 'replay',
        explanation: 'replay',
        cutDigest: r.cut_digest_a,
        perspective: r.perspective,
      });
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          proofId: uuid(r.proof_id),
          kind: r.kind,
          equivalent: r.equivalent,
          declassified: r.declassified,
          leakDetected: r.leak_detected,
          hiddenRivalIds: Object.freeze([...r.hidden_rival_ids]),
          observableDigestA: r.observable_digest_a,
          observableDigestB: r.observable_digest_b,
          resultDigest: r.result_digest,
          firstRun: false,
          projectionA: stubProj,
          projectionB: stubProj,
        }),
      });
    } finally {
      sql.release();
    }
  }

  private async persistProof(args: {
    world: WorldRef;
    proofId: UUID;
    operationDigest: string;
    kind: 'visible-equivalence' | 'cut-replay';
    queryDigest: string;
    cutA: string;
    cutB: string;
    perspective: string;
    digestA: string;
    digestB: string;
    equivalent: boolean;
    declassified: boolean;
    declassRule: string | null;
    hiddenIds: readonly string[];
    leakDetected: boolean;
    resultDigest: string;
  }): Promise<boolean> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        args.world.worldId,
        args.world.realm,
      ]);
      try {
        await sql.query(
          `INSERT INTO ontology.interpretation_law_proofs(
             world_id, realm, proof_id, operation_digest, kind, query_digest,
             cut_digest_a, cut_digest_b, perspective, observable_digest_a, observable_digest_b,
             equivalent, declassified, declassification_rule_digest, hidden_rival_ids,
             leak_detected, result_digest, laws_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            args.world.worldId,
            args.world.realm,
            args.proofId,
            args.operationDigest,
            args.kind,
            args.queryDigest,
            args.cutA,
            args.cutB,
            args.perspective,
            args.digestA,
            args.digestB,
            args.equivalent,
            args.declassified,
            args.declassRule,
            [...args.hiddenIds],
            args.leakDetected,
            args.resultDigest,
            LAWS_IMPL,
          ],
        );
        return true;
      } catch (error: unknown) {
        if (isUniqueViolation(error)) return false;
        throw error;
      }
    } finally {
      sql.release();
    }
  }
}
