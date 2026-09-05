import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';

export const IMPACT_IMPL = 'correction-impact-v1';
export const DEFAULT_IMPACT_BUDGET = 256;

export type ImpactNodeKind = 'claim' | 'interpretation' | 'case' | 'watch' | 'projection';
export type ImpactNodeStatus = 'valid' | 'stale' | 'pending';

export type RegisterImpactNodeInput = Readonly<{
  world: WorldRef;
  nodeId: string;
  kind: ImpactNodeKind;
  cutDigest: string;
  subjectId?: UUID;
  authorized?: boolean;
  contested?: boolean;
  /** Initial status; projections may start valid until invalidated. */
  status?: ImpactNodeStatus;
}>;

export type RegisterImpactEdgeInput = Readonly<{
  world: WorldRef;
  /** Dependent node (invalidated when dependency changes). */
  fromId: string;
  fromKind: ImpactNodeKind;
  /** Dependency node. */
  toId: string;
  toKind: ImpactNodeKind;
}>;

export type ConsumeCorrectionImpactInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  correctionId: UUID;
  sourceCutDigest: string;
  scopedSubjectId: UUID;
  targetClaimId: UUID;
  /** Claim node id in the impact graph (defaults to string form of targetClaimId). */
  targetClaimNodeId?: string;
  isRetraction?: boolean;
  budget?: number;
  /** Expected graph cut; mismatch → Stale. */
  expectedGraphCutDigest?: string;
}>;

export type QualityDimensions = Readonly<{
  coverage: Readonly<{ coveredNodes: number; totalAuthorizedNodes: number; ratio: string }>;
  freshness: Readonly<{ freshNodes: number; staleNodes: number; pendingProjections: number }>;
  unresolvedConsequentialConflicts: number;
  reversalRate: Readonly<{ reversals: number; corrections: number; ratio: string }>;
  affectedScope: Readonly<{
    nodeIds: readonly string[];
    kinds: readonly ImpactNodeKind[];
    projectionLag: Readonly<{
      pendingCount: number;
      sourceCutDigest: string;
      coveredCutDigest: string | null;
    }>;
  }>;
}>;

export type ImpactReceipt = Readonly<{
  runId: UUID;
  correctionId: UUID;
  invalidatedNodeIds: readonly string[];
  untouchedNodeIds: readonly string[];
  quality: QualityDimensions;
  resultDigest: string;
  firstRun: boolean;
  cycleDetected: boolean;
}>;

export type ImpactOk = Readonly<{ tag: 'Ok'; value: ImpactReceipt }>;
export type ImpactStale = Readonly<{ tag: 'Stale'; reason: 'CUT_MISMATCH' | 'BUDGET_EXCEEDED' }>;
export type ImpactDenied = Readonly<{
  tag: 'Denied';
  reason: 'INVALID_INPUT' | 'NOT_FOUND' | 'CYCLE' | 'FORBIDDEN_RIVAL';
  detail?: string;
}>;
export type ImpactOutcome = ImpactOk | ImpactStale | ImpactDenied;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

function ratio(numer: number, denom: number): string {
  if (denom === 0) return '0/0';
  return `${numer}/${denom}`;
}

/**
 * Correction impact worker (SPEC-005 / ZN-0035).
 * Computes a bounded acyclic dependency closure, marks affected interpretations /
 * Cases / Watches stale and projections pending, and exposes quality dimensions
 * without leaking unauthorized rival nodes into authorized counts.
 */
export class ImpactService {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async registerNode(input: RegisterImpactNodeInput): Promise<ImpactOutcome> {
    if (!input.nodeId || input.nodeId.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'NODE_ID' });
    }
    if (!/^[a-f0-9]{64}$/.test(input.cutDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'CUT' });
    }
    const status: ImpactNodeStatus =
      input.status ?? (input.kind === 'projection' ? 'valid' : 'valid');
    const authorized = input.authorized !== false;
    const contested = input.contested === true;
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      await sql.query(
        `INSERT INTO ontology.impact_nodes(
           world_id, realm, node_id, kind, subject_id, cut_digest, status, authorized, contested
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (world_id, realm, node_id) DO UPDATE SET
           kind=EXCLUDED.kind,
           subject_id=EXCLUDED.subject_id,
           cut_digest=EXCLUDED.cut_digest,
           status=EXCLUDED.status,
           authorized=EXCLUDED.authorized,
           contested=EXCLUDED.contested,
           updated_at=clock_timestamp()`,
        [
          input.world.worldId,
          input.world.realm,
          input.nodeId,
          input.kind,
          input.subjectId ?? null,
          input.cutDigest,
          status,
          authorized,
          contested,
        ],
      );
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          runId: this.crypto.randomId(),
          correctionId: this.crypto.randomId(),
          invalidatedNodeIds: Object.freeze([]) as readonly string[],
          untouchedNodeIds: Object.freeze([input.nodeId]) as readonly string[],
          quality: emptyQuality(input.cutDigest),
          resultDigest: sha256Text(canonicalJson({ register: input.nodeId, impl: IMPACT_IMPL } as never)),
          firstRun: true,
          cycleDetected: false,
        }),
      });
    } finally {
      sql.release();
    }
  }

  async registerEdge(input: RegisterImpactEdgeInput): Promise<ImpactOutcome> {
    if (!input.fromId || !input.toId || input.fromId === input.toId) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'EDGE' });
    }
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      await sql.query(
        `INSERT INTO ontology.impact_edges(world_id, realm, from_id, from_kind, to_id, to_kind)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (world_id, realm, from_id, to_id) DO NOTHING`,
        [input.world.worldId, input.world.realm, input.fromId, input.fromKind, input.toId, input.toKind],
      );
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          runId: this.crypto.randomId(),
          correctionId: this.crypto.randomId(),
          invalidatedNodeIds: Object.freeze([]) as readonly string[],
          untouchedNodeIds: Object.freeze([input.fromId, input.toId]) as readonly string[],
          quality: emptyQuality('0'.repeat(64)),
          resultDigest: sha256Text(
            canonicalJson({ edge: [input.fromId, input.toId], impl: IMPACT_IMPL } as never),
          ),
          firstRun: true,
          cycleDetected: false,
        }),
      });
    } finally {
      sql.release();
    }
  }

  async consumeCorrection(input: ConsumeCorrectionImpactInput): Promise<ImpactOutcome> {
    if (!/^[a-f0-9]{64}$/.test(input.sourceCutDigest)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'CUT' });
    }
    const budget = input.budget ?? DEFAULT_IMPACT_BUDGET;
    if (!Number.isInteger(budget) || budget < 1 || budget > 4096) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'BUDGET' });
    }
    const claimNodeId = input.targetClaimNodeId ?? String(input.targetClaimId);

    const opDigest = sha256Text(
      canonicalJson({
        op: 'consume-correction-impact',
        operationId: String(input.operationId),
        correctionId: String(input.correctionId),
        sourceCutDigest: input.sourceCutDigest,
        scopedSubjectId: String(input.scopedSubjectId),
        targetClaimId: String(input.targetClaimId),
        claimNodeId,
        isRetraction: input.isRetraction === true,
        impl: IMPACT_IMPL,
      } as never),
    );

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      const prior = await sql.query<{
        run_id: string;
        correction_id: string;
        invalidated_ids: string[];
        untouched_ids: string[];
        quality_json: QualityDimensions;
        result_digest: string;
        cycle_detected: boolean;
      }>(
        `SELECT run_id::text, correction_id::text, invalidated_ids, untouched_ids,
                quality_json, result_digest, cycle_detected
         FROM ontology.impact_runs
         WHERE world_id=$1 AND realm=$2 AND operation_digest=$3`,
        [input.world.worldId, input.world.realm, opDigest],
      );
      if (prior[0]) {
        const p = prior[0];
        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            runId: uuid(p.run_id),
            correctionId: uuid(p.correction_id),
            invalidatedNodeIds: Object.freeze([...p.invalidated_ids]),
            untouchedNodeIds: Object.freeze([...p.untouched_ids]),
            quality: Object.freeze(p.quality_json),
            resultDigest: p.result_digest,
            firstRun: false,
            cycleDetected: p.cycle_detected,
          }),
        });
      }

      if (input.expectedGraphCutDigest && input.expectedGraphCutDigest !== input.sourceCutDigest) {
        return Object.freeze({ tag: 'Stale' as const, reason: 'CUT_MISMATCH' as const });
      }

      const seed = await sql.query<{ node_id: string; kind: ImpactNodeKind; authorized: boolean }>(
        `SELECT node_id, kind, authorized FROM ontology.impact_nodes
         WHERE world_id=$1 AND realm=$2 AND node_id=$3`,
        [input.world.worldId, input.world.realm, claimNodeId],
      );
      if (!seed[0]) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND' as const, detail: 'CLAIM_NODE' });
      }

      const edges = await sql.query<{ from_id: string; to_id: string }>(
        `SELECT from_id, to_id FROM ontology.impact_edges WHERE world_id=$1 AND realm=$2`,
        [input.world.worldId, input.world.realm],
      );
      const dependents = new Map<string, string[]>();
      for (const e of edges) {
        const list = dependents.get(e.to_id) ?? [];
        list.push(e.from_id);
        dependents.set(e.to_id, list);
      }

      const color = new Map<string, 'white' | 'gray' | 'black'>();
      const invalidated: string[] = [];
      let cycleDetected = false;
      let budgetExceeded = false;
      let visitCount = 0;

      const visit = (nodeId: string): boolean => {
        const state = color.get(nodeId) ?? 'white';
        if (state === 'gray') {
          cycleDetected = true;
          return true;
        }
        if (state === 'black') return false;
        color.set(nodeId, 'gray');
        visitCount += 1;
        if (visitCount > budget) {
          budgetExceeded = true;
          return true;
        }
        if (nodeId !== claimNodeId) invalidated.push(nodeId);
        for (const dep of dependents.get(nodeId) ?? []) {
          if (visit(dep)) return true;
        }
        color.set(nodeId, 'black');
        return false;
      };

      visit(claimNodeId);
      if (budgetExceeded) {
        return Object.freeze({ tag: 'Stale' as const, reason: 'BUDGET_EXCEEDED' as const });
      }
      if (cycleDetected) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'CYCLE' as const });
      }

      const allNodes = await sql.query<{
        node_id: string;
        kind: ImpactNodeKind;
        status: ImpactNodeStatus;
        authorized: boolean;
        contested: boolean;
      }>(
        `SELECT node_id, kind, status, authorized, contested
         FROM ontology.impact_nodes WHERE world_id=$1 AND realm=$2`,
        [input.world.worldId, input.world.realm],
      );

      const authorizedNodes = allNodes.filter((n) => n.authorized);
      const unauthorizedHit = invalidated.some((id) => {
        const n = allNodes.find((x) => x.node_id === id);
        return n && !n.authorized;
      });
      // Forbidden rivals may exist in the graph but must not drive authorized invalidation wording.
      const authorizedInvalidated = invalidated.filter((id) => {
        const n = allNodes.find((x) => x.node_id === id);
        return n?.authorized === true;
      });
      void unauthorizedHit;

      try {
        await sql.query('BEGIN');
        for (const nodeId of authorizedInvalidated) {
          const n = allNodes.find((x) => x.node_id === nodeId);
          if (!n) continue;
          const nextStatus: ImpactNodeStatus = n.kind === 'projection' ? 'pending' : 'stale';
          await sql.query(
            `UPDATE ontology.impact_nodes
             SET status=$4, updated_at=clock_timestamp()
             WHERE world_id=$1 AND realm=$2 AND node_id=$3 AND authorized=true`,
            [input.world.worldId, input.world.realm, nodeId, nextStatus],
          );
        }
        // Refresh in-memory statuses after updates
        for (const n of allNodes) {
          if (authorizedInvalidated.includes(n.node_id) && n.authorized) {
            n.status = n.kind === 'projection' ? 'pending' : 'stale';
          }
        }

        const authAfter = allNodes.filter((n) => n.authorized);
        const fresh = authAfter.filter((n) => n.status === 'valid').length;
        const stale = authAfter.filter((n) => n.status === 'stale').length;
        const pending = authAfter.filter((n) => n.status === 'pending' && n.kind === 'projection').length;
        const contested = authAfter.filter((n) => n.contested && n.status === 'stale').length;
        const covered = authAfter.filter((n) => n.status === 'valid').length;

        const priorRuns = await sql.query<{ is_retraction: boolean }>(
          `SELECT is_retraction FROM ontology.impact_runs WHERE world_id=$1 AND realm=$2`,
          [input.world.worldId, input.world.realm],
        );
        const corrections = priorRuns.length + 1;
        const reversals = priorRuns.filter((r) => r.is_retraction).length + (input.isRetraction ? 1 : 0);

        const kinds = Object.freeze(
          Array.from(
            new Set(
              authorizedInvalidated
                .map((id) => allNodes.find((n) => n.node_id === id)?.kind)
                .filter((k): k is ImpactNodeKind => Boolean(k)),
            ),
          ),
        );

        const quality: QualityDimensions = Object.freeze({
          coverage: Object.freeze({
            coveredNodes: covered,
            totalAuthorizedNodes: authAfter.length,
            ratio: ratio(covered, authAfter.length),
          }),
          freshness: Object.freeze({
            freshNodes: fresh,
            staleNodes: stale,
            pendingProjections: pending,
          }),
          unresolvedConsequentialConflicts: contested,
          reversalRate: Object.freeze({
            reversals,
            corrections,
            ratio: ratio(reversals, corrections),
          }),
          affectedScope: Object.freeze({
            nodeIds: Object.freeze([...authorizedInvalidated]),
            kinds,
            projectionLag: Object.freeze({
              pendingCount: pending,
              sourceCutDigest: input.sourceCutDigest,
              coveredCutDigest: pending === 0 ? input.sourceCutDigest : null,
            }),
          }),
        });

        const untouched = authAfter
          .map((n) => n.node_id)
          .filter((id) => id !== claimNodeId && !authorizedInvalidated.includes(id));

        const resultDigest = sha256Text(
          canonicalJson({
            correctionId: String(input.correctionId),
            invalidated: authorizedInvalidated,
            untouched,
            quality,
            impl: IMPACT_IMPL,
          } as never),
        );
        const runId = this.crypto.randomId();

        await sql.query(
          `INSERT INTO ontology.impact_runs(
             world_id, realm, run_id, operation_digest, correction_id, source_cut_digest,
             scoped_subject_id, target_claim_id, is_retraction, invalidated_ids, untouched_ids,
             quality_json, result_digest, cycle_detected, impact_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,false,$14)`,
          [
            input.world.worldId,
            input.world.realm,
            runId,
            opDigest,
            input.correctionId,
            input.sourceCutDigest,
            input.scopedSubjectId,
            input.targetClaimId,
            input.isRetraction === true,
            authorizedInvalidated,
            untouched,
            JSON.stringify(quality),
            resultDigest,
            IMPACT_IMPL,
          ],
        );
        await sql.query('COMMIT');

        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            runId,
            correctionId: input.correctionId,
            invalidatedNodeIds: Object.freeze([...authorizedInvalidated]),
            untouchedNodeIds: Object.freeze([...untouched]),
            quality,
            resultDigest,
            firstRun: true,
            cycleDetected: false,
          }),
        });
      } catch (error: unknown) {
        await sql.query('ROLLBACK');
        if (isUniqueViolation(error)) return this.consumeCorrection(input);
        throw error;
      }
    } finally {
      sql.release();
    }
  }

  async nodeStatus(
    world: WorldRef,
    nodeId: string,
  ): Promise<{ status: ImpactNodeStatus; authorized: boolean; kind: ImpactNodeKind } | null> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        world.worldId,
        world.realm,
      ]);
      const rows = await sql.query<{ status: ImpactNodeStatus; authorized: boolean; kind: ImpactNodeKind }>(
        `SELECT status, authorized, kind FROM ontology.impact_nodes
         WHERE world_id=$1 AND realm=$2 AND node_id=$3`,
        [world.worldId, world.realm, nodeId],
      );
      return rows[0] ?? null;
    } finally {
      sql.release();
    }
  }
}

function emptyQuality(cut: string): QualityDimensions {
  return Object.freeze({
    coverage: Object.freeze({ coveredNodes: 0, totalAuthorizedNodes: 0, ratio: '0/0' }),
    freshness: Object.freeze({ freshNodes: 0, staleNodes: 0, pendingProjections: 0 }),
    unresolvedConsequentialConflicts: 0,
    reversalRate: Object.freeze({ reversals: 0, corrections: 0, ratio: '0/0' }),
    affectedScope: Object.freeze({
      nodeIds: Object.freeze([]) as readonly string[],
      kinds: Object.freeze([]) as readonly ImpactNodeKind[],
      projectionLag: Object.freeze({
        pendingCount: 0,
        sourceCutDigest: cut,
        coveredCutDigest: cut,
      }),
    }),
  });
}
