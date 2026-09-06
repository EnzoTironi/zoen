import { randomUUID } from "node:crypto";

import {
  Conflict,
  InvalidInput,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import {
  CaseRef,
  QuestionRef,
  Revision,
  WorldRef,
} from "@zoen/contracts/d01/values";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import {
  IdentityProposed,
  ProposeIdentityResolution,
  ProposeIdentitySplit,
  ProposeIdentityUndo,
} from "@zoen/contracts/subject-identity/operations";
import { IdentityQuestion } from "@zoen/contracts/subject-identity/question";
import {
  IdentityAssertionRef,
  IdentityDecisionRef,
  IdentityEffectRef,
} from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { bindWorldIntent } from "../../../commit/intent.js";
import {
  commitMutation,
  readMutationReplay,
} from "../../../commit/mutation.js";
import { CurrentInternalBasis, DomainKey } from "../../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../../ports/d01/context.js";
import { canonicalJson, structuredDigest } from "../../../values/canonical.js";
import {
  identityScopeFrom,
  loadIdentityProjection,
} from "../persistence/decisions.js";
import {
  maximalIdentityCells,
  validateComparisonClaims,
} from "../pure/cells.js";
import { compareIdentityCells } from "../pure/comparison.js";
import { IdentityDecision, projectIdentity } from "../pure/events.js";
import { closeIdentity } from "../pure/graph.js";
import type { IdentityEffectDraft } from "../pure/planning.js";
import {
  bindIdentityEffectIds,
  planResolutionEffects,
  planSplitEffects,
} from "../pure/planning.js";
import { loadIdentityFrame } from "./frame.js";

const impactApplied = {
  appliedCorrections: "preserved-per-literal-anchor" as const,
  audience: "private-author" as const,
  futureClaims: "identity-applies-within-interval" as const,
  historicalFrames: "preserved" as const,
  pendingCases: "invalidated-by-identity-change" as const,
};
const impactUnchanged = {
  ...impactApplied,
  pendingCases: "unchanged" as const,
};

const nextRevision = (decisions: readonly IdentityDecision[]) => {
  let max = -1n;
  for (const decision of decisions) {
    const value = BigInt(decision.revision);
    if (value > max) {
      max = value;
    }
  }
  return String(max + 1n);
};

const ensureCurrentBasis = (basis: unknown) =>
  Schema.decodeUnknownEffect(CurrentInternalBasis)(basis).pipe(
    Effect.mapError(() => new Stale({ code: "STALE" }))
  );

const allocateEffects = Effect.fn("subjectIdentity.allocateEffects")(
  function* allocateEffects(drafts: readonly IdentityEffectDraft[]) {
    const ids = [];
    for (const draft of drafts) {
      ids.push({
        assertionRef:
          draft._tag === "Assert"
            ? yield* Schema.decodeEffect(IdentityAssertionRef)(randomUUID())
            : null,
        effectRef: yield* Schema.decodeEffect(IdentityEffectRef)(randomUUID()),
      });
    }
    return yield* bindIdentityEffectIds(drafts, ids);
  }
);

const saveProposal = Effect.fn("subjectIdentity.saveProposal")(
  function* saveProposal(input: {
    readonly bound: Effect.Success<ReturnType<typeof bindWorldIntent>>;
    readonly caseRef: typeof CaseRef.Type;
    readonly context: VerifiedRequestContext;
    readonly frameRef: string;
    readonly question: typeof IdentityQuestion.Type;
    readonly questionRef: typeof QuestionRef.Type;
    readonly savedBasis: typeof CurrentInternalBasis.Type;
    readonly subjectKey: string;
    readonly worldRef: WorldRef;
  }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* commitMutation(input.context, input.bound, {
      apply: (receiptRef, cut) =>
        Effect.gen(function* writeCase() {
          const revision = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut.cases) + 1n).toString()
          );
          const basis = yield* Schema.decodeUnknownEffect(CurrentInternalBasis)(
            {
              ...input.savedBasis,
              cut: { ...input.savedBasis.cut, cases: revision },
            }
          );
          const basisJson = yield* canonicalJson(basis);
          const questionJson = yield* canonicalJson(input.question);
          const consequenceJson = yield* canonicalJson({
            kind: "subject-identity",
            questionRef: input.questionRef,
          });
          yield* sql`INSERT INTO authority.cases
          (world_id, realm, case_id, principal_id, frame_id, subject_key, state, question_ref, question, consequence, internal_basis, introduced_receipt_id)
          VALUES (${input.worldRef.worldId}, ${input.worldRef.realm}, ${input.caseRef}, ${input.context.presence.principalId}, ${input.frameRef},
            ${input.subjectKey}, 'proposed', ${input.questionRef}, ${questionJson}::jsonb, ${consequenceJson}::jsonb, ${basisJson}::jsonb, ${receiptRef})`;
          for (const source of basis.readSet.sources) {
            yield* sql`INSERT INTO authority.pins (world_id, realm, evidence_id, owner_kind, owner_id, created_at)
            VALUES (${input.worldRef.worldId}, ${input.worldRef.realm}, ${source.evidenceRef}, 'case', ${input.caseRef}, clock_timestamp())`;
          }
          return {
            changedDomains: ["cases"] as const,
            result: {
              _tag: "IdentityProposed" as const,
              question: input.question,
              receiptRef,
            },
          };
        }).pipe(
          Effect.catchTag(
            "SchemaError",
            () => new Unavailable({ code: "UNAVAILABLE" })
          )
        ),
      basis: input.savedBasis,
      domains: DomainKey.literals,
    });
  }
);

export const proposeIdentityResolution = Effect.fn(
  "subjectIdentity.proposeResolution"
)(
  function* proposeIdentityResolution(
    context: VerifiedRequestContext,
    input: typeof ProposeIdentityResolution.Type
  ) {
    const request = yield* Schema.decodeEffect(ProposeIdentityResolution)(
      input
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(IdentityProposed)(replay);
    }
    const saved = yield* loadIdentityFrame(
      context,
      request.worldRef,
      request.input.frame.frameRef
    );
    if (saved.visible_frame.kind !== "subject-identity") {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const frame: IdentityFrame = saved.visible_frame;
    const basis = yield* ensureCurrentBasis(saved.internal_basis);
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const scope = identityScopeFrom(
      request.worldRef,
      principalRef,
      context.purpose
    );
    const projection = yield* loadIdentityProjection(scope);
    const plans = yield* planResolutionEffects(
      projection,
      frame,
      request.input.left,
      request.input.right
    );
    const left =
      request.input.left < request.input.right
        ? request.input.left
        : request.input.right;
    const right =
      request.input.left < request.input.right
        ? request.input.right
        : request.input.left;
    const alternatives: unknown[] = [];
    const blocked: unknown[] = [];
    for (const answer of ["same-as", "different-from"] as const) {
      const plan = plans[answer];
      if (plan._tag === "Blocked") {
        blocked.push({
          answer,
          reason: plan.blocked.reason,
          supportingRefs: plan.blocked.supportingRefs,
        });
        continue;
      }
      const effectItems = yield* allocateEffects(plan.effectItems);
      let afterCells = frame.cells;
      if (effectItems.length > 0) {
        const decisionRef =
          yield* Schema.decodeEffect(IdentityDecisionRef)(randomUUID());
        const provisional = yield* Schema.decodeEffect(IdentityDecision)({
          authoredBy: principalRef,
          decisionRef,
          effectItems,
          interval: frame.interval,
          kind: "resolution",
          purpose: context.purpose,
          revision: nextRevision(projection.decisions),
          targetDecisionRef: null,
          worldRef: request.worldRef,
        }).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
        const next = yield* projectIdentity(scope, [
          ...projection.decisions,
          provisional,
        ]).pipe(Effect.mapError(() => new Conflict({ code: "CONFLICT" })));
        const closure = yield* closeIdentity(
          next,
          frame.closureAnchors,
          frame.interval
        );
        const claims = yield* validateComparisonClaims(closure, frame.claims);
        const cells = yield* maximalIdentityCells(
          closure,
          frame.interval,
          claims
        );
        afterCells = yield* compareIdentityCells(closure, cells, claims);
      }
      alternatives.push({
        afterCells,
        answer,
        effectItems,
        impact: effectItems.length === 0 ? impactUnchanged : impactApplied,
      });
    }
    alternatives.push({
      afterCells: frame.cells,
      answer: "unknown",
      effectItems: [],
      impact: impactUnchanged,
    });
    const caseRef = yield* Schema.decodeEffect(CaseRef)(randomUUID());
    const questionRef = yield* Schema.decodeEffect(QuestionRef)(randomUUID());
    const consequenceDigest = yield* structuredDigest("identity-consequence", {
      alternatives,
      blockedAlternatives: blocked,
      frameRef: frame.frameRef,
      intent: { left, right },
      kind: "identity-resolution",
    });
    const question = yield* Schema.decodeUnknownEffect(IdentityQuestion)({
      alternatives,
      audience: "private-author",
      blockedAlternatives: blocked,
      caseRef,
      consequenceDigest,
      frame: { frameRef: frame.frameRef, kind: "subject-identity" },
      intent: { left, right },
      interval: frame.interval,
      kind: "identity-resolution",
      purpose: context.purpose,
      questionRef,
      schemaVersion: "subject-identity.v1",
      worldRef: request.worldRef,
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const encoded = new TextEncoder().encode(yield* canonicalJson(question));
    if (encoded.byteLength > 1_048_576) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const result = yield* saveProposal({
      bound,
      caseRef,
      context,
      frameRef: frame.frameRef,
      question,
      questionRef,
      savedBasis: basis,
      subjectKey: left,
      worldRef: request.worldRef,
    });
    return yield* Schema.decodeUnknownEffect(IdentityProposed)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const proposeIdentitySplit = Effect.fn("subjectIdentity.proposeSplit")(
  function* proposeIdentitySplit(
    context: VerifiedRequestContext,
    input: typeof ProposeIdentitySplit.Type
  ) {
    const request = yield* Schema.decodeEffect(ProposeIdentitySplit)(
      input
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(IdentityProposed)(replay);
    }
    const saved = yield* loadIdentityFrame(
      context,
      request.worldRef,
      request.input.frame.frameRef
    );
    if (saved.visible_frame.kind !== request.input.frame.kind) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const frame: IdentityFrame | IdentityRecoveryFrame = saved.visible_frame;
    const basis = yield* ensureCurrentBasis(saved.internal_basis);
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const scope = identityScopeFrom(
      request.worldRef,
      principalRef,
      context.purpose
    );
    const projection = yield* loadIdentityProjection(scope);
    const plan = yield* planSplitEffects(
      projection,
      frame,
      request.input.anchor,
      request.input.partitionsByCell
    );
    const blocked: unknown[] = [];
    const alternatives: unknown[] = [];
    if (plan._tag === "Blocked") {
      blocked.push({
        answer: "confirm",
        reason: plan.blocked.reason,
        supportingRefs: plan.blocked.supportingRefs,
      });
    } else {
      const effectItems = yield* allocateEffects(plan.effectItems);
      const decisionRef =
        yield* Schema.decodeEffect(IdentityDecisionRef)(randomUUID());
      const provisional = yield* Schema.decodeEffect(IdentityDecision)({
        authoredBy: principalRef,
        decisionRef,
        effectItems,
        interval: frame.interval,
        kind: "split",
        purpose: context.purpose,
        revision: nextRevision(projection.decisions),
        targetDecisionRef: null,
        worldRef: request.worldRef,
      }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
      const next = yield* projectIdentity(scope, [
        ...projection.decisions,
        provisional,
      ]).pipe(Effect.mapError(() => new Conflict({ code: "CONFLICT" })));
      const closure = yield* closeIdentity(
        next,
        frame.closureAnchors,
        frame.interval
      );
      const drafts = yield* maximalIdentityCells(
        closure,
        frame.interval,
        frame.kind === "subject-identity" ? frame.claims : []
      );
      const afterCells =
        frame.kind === "subject-identity"
          ? yield* compareIdentityCells(closure, drafts, frame.claims)
          : drafts.map((cell) => ({
              ...cell.structure,
              cellRef: cell.cellRef,
            }));
      alternatives.push({
        afterCells,
        answer: "confirm",
        ...(frame.kind === "subject-identity-recovery"
          ? { comparison: "not-requested" }
          : {}),
        effectItems,
        impact: impactApplied,
      });
    }
    if (frame.kind === "subject-identity") {
      alternatives.push({
        afterCells: frame.cells,
        answer: "unknown",
        effectItems: [],
        impact: impactUnchanged,
      });
    } else {
      alternatives.push({
        afterCells: frame.cells,
        answer: "unknown",
        comparison: "not-requested",
        effectItems: [],
        impact: impactUnchanged,
      });
    }
    const caseRef = yield* Schema.decodeEffect(CaseRef)(randomUUID());
    const questionRef = yield* Schema.decodeEffect(QuestionRef)(randomUUID());
    const kind =
      frame.kind === "subject-identity"
        ? ("identity-split" as const)
        : ("identity-recovery-split" as const);
    const intent = {
      anchor: request.input.anchor,
      partitionsByCell: request.input.partitionsByCell,
    };
    const consequenceDigest = yield* structuredDigest("identity-consequence", {
      alternatives,
      blockedAlternatives: blocked,
      frameRef: frame.frameRef,
      intent,
      kind,
    });
    const question = yield* Schema.decodeUnknownEffect(IdentityQuestion)({
      alternatives,
      audience: "private-author",
      blockedAlternatives: blocked,
      caseRef,
      consequenceDigest,
      ...(frame.kind === "subject-identity-recovery"
        ? { comparison: "not-requested" }
        : {}),
      frame: { frameRef: frame.frameRef, kind: frame.kind },
      intent,
      interval: frame.interval,
      kind,
      purpose: context.purpose,
      questionRef,
      schemaVersion: "subject-identity.v1",
      worldRef: request.worldRef,
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const encoded = new TextEncoder().encode(yield* canonicalJson(question));
    if (encoded.byteLength > 1_048_576) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const result = yield* saveProposal({
      bound,
      caseRef,
      context,
      frameRef: frame.frameRef,
      question,
      questionRef,
      savedBasis: basis,
      subjectKey: request.input.anchor,
      worldRef: request.worldRef,
    });
    return yield* Schema.decodeUnknownEffect(IdentityProposed)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const proposeIdentityUndo = Effect.fn("subjectIdentity.proposeUndo")(
  function* proposeIdentityUndo(
    context: VerifiedRequestContext,
    input: typeof ProposeIdentityUndo.Type
  ) {
    const request = yield* Schema.decodeEffect(ProposeIdentityUndo)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(IdentityProposed)(replay);
    }
    const saved = yield* loadIdentityFrame(
      context,
      request.worldRef,
      request.input.frame.frameRef
    );
    const frame: IdentityFrame | IdentityRecoveryFrame = saved.visible_frame;
    const basis = yield* ensureCurrentBasis(saved.internal_basis);
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const scope = identityScopeFrom(
      request.worldRef,
      principalRef,
      context.purpose
    );
    const projection = yield* loadIdentityProjection(scope);
    const target = projection.decisions.find(
      (decision) => decision.decisionRef === request.input.targetDecisionRef
    );
    if (
      target === undefined ||
      target.kind === "undo" ||
      projection.undoneDecisionRefs.includes(target.decisionRef)
    ) {
      return yield* new Stale({ code: "STALE" });
    }
    const effectItems = yield* allocateEffects(
      target.effectItems.map((item) => ({
        _tag: "UndoEffect" as const,
        targetEffectRef: item.effectRef,
      }))
    );
    const decisionRef =
      yield* Schema.decodeEffect(IdentityDecisionRef)(randomUUID());
    const provisional = yield* Schema.decodeEffect(IdentityDecision)({
      authoredBy: principalRef,
      decisionRef,
      effectItems,
      interval: target.interval,
      kind: "undo",
      purpose: context.purpose,
      revision: nextRevision(projection.decisions),
      targetDecisionRef: target.decisionRef,
      worldRef: request.worldRef,
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const next = yield* projectIdentity(scope, [
      ...projection.decisions,
      provisional,
    ]).pipe(Effect.mapError(() => new Conflict({ code: "CONFLICT" })));
    const closure = yield* closeIdentity(
      next,
      frame.closureAnchors,
      frame.interval
    );
    const drafts = yield* maximalIdentityCells(closure, frame.interval, []);
    const structureCells = drafts.map((cell) => ({
      ...cell.structure,
      cellRef: cell.cellRef,
    }));
    const afterCells =
      frame.kind === "subject-identity"
        ? yield* compareIdentityCells(
            closure,
            yield* maximalIdentityCells(closure, frame.interval, frame.claims),
            frame.claims
          )
        : structureCells;
    const alternatives =
      frame.kind === "subject-identity"
        ? [
            {
              afterCells,
              answer: "confirm" as const,
              effectItems,
              impact: impactApplied,
            },
            {
              afterCells: frame.cells,
              answer: "unknown" as const,
              effectItems: [],
              impact: impactUnchanged,
            },
          ]
        : [
            {
              afterCells: structureCells,
              answer: "confirm" as const,
              comparison: "not-requested" as const,
              effectItems,
              impact: impactApplied,
            },
            {
              afterCells: frame.cells,
              answer: "unknown" as const,
              comparison: "not-requested" as const,
              effectItems: [],
              impact: impactUnchanged,
            },
          ];
    const caseRef = yield* Schema.decodeEffect(CaseRef)(randomUUID());
    const questionRef = yield* Schema.decodeEffect(QuestionRef)(randomUUID());
    const kind =
      frame.kind === "subject-identity"
        ? ("identity-undo" as const)
        : ("identity-recovery-undo" as const);
    const consequenceDigest = yield* structuredDigest("identity-consequence", {
      alternatives,
      blockedAlternatives: [],
      frameRef: frame.frameRef,
      intent: { targetDecisionRef: target.decisionRef },
      kind,
    });
    const question = yield* Schema.decodeUnknownEffect(IdentityQuestion)({
      alternatives,
      audience: "private-author",
      blockedAlternatives: [],
      caseRef,
      consequenceDigest,
      ...(frame.kind === "subject-identity-recovery"
        ? { comparison: "not-requested" }
        : {}),
      frame: { frameRef: frame.frameRef, kind: frame.kind },
      intent: { targetDecisionRef: target.decisionRef },
      interval: frame.interval,
      kind,
      purpose: context.purpose,
      questionRef,
      schemaVersion: "subject-identity.v1",
      worldRef: request.worldRef,
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const result = yield* saveProposal({
      bound,
      caseRef,
      context,
      frameRef: frame.frameRef,
      question,
      questionRef,
      savedBasis: basis,
      subjectKey:
        frame.kind === "subject-identity"
          ? [...frame.requestedAnchors].toSorted()[0]!
          : frame.anchor,
      worldRef: request.worldRef,
    });
    return yield* Schema.decodeUnknownEffect(IdentityProposed)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
