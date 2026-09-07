import { describe, expect, it } from "@effect/vitest";
import { IdentityRecoveryFrame } from "@zoen/contracts/subject-identity/frame";
import { IdentityQuestion } from "@zoen/contracts/subject-identity/question";
import {
  IdentityEffectRef,
  SUBJECT_IDENTITY_LIMITS,
} from "@zoen/contracts/subject-identity/values";
import { D01_LIMITS, SubjectKey } from "@zoen/contracts/worlds/values";
import { Effect, Result, Schema } from "effect";

import { maximalIdentityCells } from "../../../src/knowledge/subject-identity/pure/cells.js";
import { projectIdentity } from "../../../src/knowledge/subject-identity/pure/events.js";
import { closeIdentity } from "../../../src/knowledge/subject-identity/pure/graph.js";
import {
  bindIdentityEffectIds,
  planSplitEffects,
} from "../../../src/knowledge/subject-identity/pure/planning.js";
import {
  canonicalJson,
  structuredDigest,
} from "../../../src/values/canonical.js";
import { assertEdge, claim, decision, id, period, scope } from "./fixtures.js";

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

const measure = (value: unknown) =>
  Effect.gen(function* measureQuestion() {
    const json = yield* canonicalJson(value);
    return {
      bytes: new TextEncoder().encode(json).byteLength,
      json,
    };
  });

const key = Schema.decodeSync(SubjectKey);
const effectRef = Schema.decodeSync(IdentityEffectRef);

describe("EX27 recovery Question prospective limits", () => {
  it.effect(
    "recovery undo Question fits response bytes/entries/depth and is claim-invariant",
    () =>
      Effect.gen(function* recoveryUndoFits() {
        const edge = assertEdge(1, "A", "B");
        const projection = yield* projectIdentity(scope, [decision(1, [edge])]);
        const closure = yield* closeIdentity(
          projection,
          [edge.left, edge.right],
          period()
        );
        const claims = Array.from({ length: D01_LIMITS.frameClaims }, (_, i) =>
          claim(i + 1, i % 2 === 0 ? "A" : "B")
        );
        const compared = yield* maximalIdentityCells(closure, period(), claims);
        expect(
          compared.some((cell) => cell.coveredClaimRefs.length > 0)
        ).toBeTruthy();
        const recoveryBefore = yield* maximalIdentityCells(
          closure,
          period(),
          []
        );
        const recoveryAfterClaimPressure = yield* maximalIdentityCells(
          closure,
          period(),
          []
        );
        expect(recoveryAfterClaimPressure).toStrictEqual(recoveryBefore);
        const structureCells = recoveryBefore.map((cell) => ({
          ...cell.structure,
          cellRef: cell.cellRef,
        }));
        const alternatives = [
          {
            afterCells: structureCells,
            answer: "confirm" as const,
            comparison: "not-requested" as const,
            effectItems: [
              {
                _tag: "UndoEffect" as const,
                effectRef: effectRef(id(9001)),
                targetEffectRef: edge.effectRef,
              },
            ],
            impact: impactApplied,
          },
          {
            afterCells: structureCells,
            answer: "unknown" as const,
            comparison: "not-requested" as const,
            effectItems: [],
            impact: impactUnchanged,
          },
        ];
        const frameRef = id(7001);
        const consequenceDigest = yield* structuredDigest(
          "identity-consequence",
          {
            alternatives,
            blockedAlternatives: [],
            frameRef,
            intent: { targetDecisionRef: id(1001) },
            kind: "identity-recovery-undo",
          }
        );
        const question = yield* Schema.decodeUnknownEffect(IdentityQuestion)({
          alternatives,
          audience: "private-author",
          blockedAlternatives: [],
          caseRef: id(7002),
          comparison: "not-requested",
          consequenceDigest,
          frame: { frameRef, kind: "subject-identity-recovery" },
          intent: { targetDecisionRef: id(1001) },
          interval: period(),
          kind: "identity-recovery-undo",
          purpose: scope.purpose,
          questionRef: id(7003),
          schemaVersion: "subject-identity.v1",
          worldRef: scope.worldRef,
        });
        const measured = yield* measure(question);
        expect(measured.bytes).toBeGreaterThan(0);
        expect(measured.bytes).toBeLessThanOrEqual(D01_LIMITS.responseBytes);
        expect(
          measured.json.includes("claimRef") ||
            measured.json.includes("obligation.amount")
        ).toBeFalsy();
      })
  );

  it.effect(
    "recovery split blocks confirm with QuotaExceeded when prospective effects exceed budget",
    () =>
      Effect.gen(function* recoverySplitQuota() {
        const labels = Array.from(
          { length: SUBJECT_IDENTITY_LIMITS.anchors },
          (_, i) => `a${i.toString().padStart(2, "0")}`
        );
        const effects = [];
        for (const [index, left] of labels.entries()) {
          const right = labels[index + 1];
          if (right === undefined) {
            break;
          }
          effects.push(assertEdge(index + 1, left, right));
        }
        const projection = yield* projectIdentity(scope, [
          decision(1, effects),
        ]);
        const anchors = labels.map((label) => key(label));
        const closure = yield* closeIdentity(projection, anchors, period());
        expect(closure.segments.length).toBeLessThanOrEqual(
          SUBJECT_IDENTITY_LIMITS.segments
        );
        const drafts = yield* maximalIdentityCells(closure, period(), []);
        const structureCells = drafts.map((cell) => ({
          ...cell.structure,
          cellRef: cell.cellRef,
        }));
        const frame = yield* Schema.decodeUnknownEffect(IdentityRecoveryFrame)({
          anchor: anchors[0],
          assertionSegments: closure.segments,
          audience: "private-author",
          cells: structureCells,
          closureAnchors: closure.anchors,
          comparison: "not-requested",
          frameRef: id(8001),
          interval: period(),
          kind: "subject-identity-recovery",
          purpose: scope.purpose,
          schemaVersion: "subject-identity.v1",
          targetDecisionRef: id(1001),
          worldRef: scope.worldRef,
        });
        const partitionsByCell = frame.cells.map((cell) => ({
          blocks: cell.components.flatMap((component) =>
            component.members.map((member) => [member])
          ),
          cellRef: cell.cellRef,
        }));
        const plan = yield* planSplitEffects(
          projection,
          frame,
          frame.anchor,
          partitionsByCell
        );
        expect(plan._tag).toBe("Blocked");
        if (plan._tag === "Blocked") {
          expect(plan.blocked.reason).toBe("QuotaExceeded");
        }
        const oversized = Array.from(
          { length: SUBJECT_IDENTITY_LIMITS.effectItems + 1 },
          (_, index) => ({
            _tag: "UndoEffect" as const,
            targetEffectRef: effectRef(id(10_000 + index)),
          })
        );
        const bind = yield* Effect.result(
          bindIdentityEffectIds(
            oversized,
            oversized.map((_, index) => ({
              assertionRef: null,
              effectRef: effectRef(id(20_000 + index)),
            }))
          )
        );
        expect(Result.isFailure(bind)).toBeTruthy();
        if (Result.isFailure(bind)) {
          expect(bind.failure._tag).toBe("QuotaExceeded");
        }
      })
  );

  it.effect(
    "IdentityQuestion schema refuses oversized recovery afterCells without truncation",
    () =>
      Effect.gen(function* refuseBloatedRecoveryQuestion() {
        const edge = assertEdge(1, "A", "B");
        const projection = yield* projectIdentity(scope, [decision(1, [edge])]);
        const closure = yield* closeIdentity(
          projection,
          [edge.left, edge.right],
          period()
        );
        const drafts = yield* maximalIdentityCells(closure, period(), []);
        const [first] = drafts;
        expect(first).toBeDefined();
        if (first === undefined) {
          return;
        }
        const base = {
          ...first.structure,
          cellRef: first.cellRef,
        };
        const bloatedCells = Array.from(
          { length: SUBJECT_IDENTITY_LIMITS.cells + 1 },
          () => base
        );
        const decoded = yield* Effect.result(
          Schema.decodeUnknownEffect(IdentityQuestion)({
            alternatives: [
              {
                afterCells: bloatedCells,
                answer: "confirm",
                comparison: "not-requested",
                effectItems: [
                  {
                    _tag: "UndoEffect",
                    effectRef: effectRef(id(9001)),
                    targetEffectRef: edge.effectRef,
                  },
                ],
                impact: impactApplied,
              },
              {
                afterCells: bloatedCells,
                answer: "unknown",
                comparison: "not-requested",
                effectItems: [],
                impact: impactUnchanged,
              },
            ],
            audience: "private-author",
            blockedAlternatives: [],
            caseRef: id(7002),
            comparison: "not-requested",
            consequenceDigest: "ab".repeat(32),
            frame: { frameRef: id(7001), kind: "subject-identity-recovery" },
            intent: { targetDecisionRef: id(1001) },
            interval: period(),
            kind: "identity-recovery-undo",
            purpose: scope.purpose,
            questionRef: id(7003),
            schemaVersion: "subject-identity.v1",
            worldRef: scope.worldRef,
          })
        );
        expect(Result.isFailure(decoded)).toBeTruthy();
      })
  );
});
