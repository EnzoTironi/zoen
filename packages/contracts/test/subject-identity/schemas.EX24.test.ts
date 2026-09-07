import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { AssertIdentity } from "../../src/subject-identity/effects.js";
import {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "../../src/subject-identity/frame.js";
import {
  SubjectIdentityRequest,
  SubjectIdentitySuccess,
} from "../../src/subject-identity/operations.js";
import {
  IdentityPartitions,
  IdentityQuestion,
} from "../../src/subject-identity/question.js";
import { D01Request, CorrectionRequest } from "../../src/worlds/operations.js";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const digest = "a".repeat(64);
const interval = { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" };
const worldRef = { realm: "live", worldId: id };
const envelope = {
  purpose: "personal-records",
  schemaVersion: "subject-identity.v1",
  worldRef,
};
const structure = {
  activeAssertionRefs: [],
  cellRef: digest,
  components: [
    { members: ["A"], representative: "A" },
    { members: ["B"], representative: "B" },
  ],
  distinctions: [],
  interval,
};
const recovery = {
  ...envelope,
  anchor: "A",
  assertionSegments: [],
  audience: "private-author",
  cells: [structure],
  closureAnchors: ["A", "B"],
  comparison: "not-requested",
  frameRef: id,
  interval,
  kind: "subject-identity-recovery",
  targetDecisionRef: null,
};
const framePointer = { frameRef: id, kind: "subject-identity" };
const recoveryPointer = { frameRef: id, kind: "subject-identity-recovery" };
const impact = {
  appliedCorrections: "preserved-per-literal-anchor",
  audience: "private-author",
  futureClaims: "identity-applies-within-interval",
  historicalFrames: "preserved",
  pendingCases: "unchanged",
};
const assertion = {
  _tag: "Assert",
  assertionRef: id,
  effectRef: otherId,
  interval,
  left: "A",
  relation: "same-as",
  right: "B",
};
const unknownAlternative = {
  afterCells: [structure],
  answer: "unknown",
  comparison: "not-requested",
  effectItems: [],
  impact,
};
const recoveryQuestion = {
  ...envelope,
  alternatives: [unknownAlternative],
  audience: "private-author",
  blockedAlternatives: [
    {
      answer: "confirm",
      reason: "ConflictingDistinction",
      supportingRefs: [id],
    },
  ],
  caseRef: id,
  comparison: "not-requested",
  consequenceDigest: digest,
  frame: recoveryPointer,
  intent: { targetDecisionRef: otherId },
  interval,
  kind: "identity-recovery-undo",
  questionRef: id,
};

describe("EX24 closed subject identity schemas", () => {
  it("admits the six operations without expanding a legacy family", () => {
    const requests = [
      {
        ...envelope,
        input: { anchors: ["A", "B"], atFrame: null, interval },
        operation: "InspectSubjectIdentity",
      },
      {
        ...envelope,
        input: {
          anchor: "A",
          atFrame: null,
          interval,
          targetDecisionRef: null,
        },
        operation: "InspectIdentityRecovery",
      },
      {
        ...envelope,
        input: { frame: framePointer, left: "A", right: "B" },
        operation: "ProposeIdentityResolution",
        operationId: id,
      },
      {
        ...envelope,
        input: {
          anchor: "A",
          frame: recoveryPointer,
          partitionsByCell: [{ blocks: [["A"], ["B"]], cellRef: digest }],
        },
        operation: "ProposeIdentitySplit",
        operationId: id,
      },
      {
        ...envelope,
        input: { frame: recoveryPointer, targetDecisionRef: otherId },
        operation: "ProposeIdentityUndo",
        operationId: id,
      },
      {
        ...envelope,
        input: {
          answer: "unknown",
          consequenceDigest: digest,
          questionRef: id,
        },
        operation: "ResolveIdentity",
        operationId: id,
      },
    ];
    for (const request of requests) {
      expect(Schema.is(SubjectIdentityRequest)(request)).toBeTruthy();
      expect(Schema.is(D01Request)(request)).toBeFalsy();
      expect(Schema.is(CorrectionRequest)(request)).toBeFalsy();
      for (const field of ["role", "capability", "basis", "principalRef"]) {
        expect(
          Schema.is(SubjectIdentityRequest)({ ...request, [field]: id })
        ).toBeFalsy();
      }
    }
  });

  it("rejects recovery as new equivalence consent and refuses reflexive pairs", () => {
    const request = {
      ...envelope,
      input: { frame: framePointer, left: "A", right: "B" },
      operation: "ProposeIdentityResolution",
      operationId: id,
    };
    for (const input of [
      { ...request.input, frame: recoveryPointer },
      { ...request.input, right: "A" },
      { ...request.input, sourceRef: id },
      { ...request.input, frame: { ...framePointer, basis: {} } },
    ]) {
      expect(
        Schema.is(SubjectIdentityRequest)({ ...request, input })
      ).toBeFalsy();
    }
    expect(
      Schema.is(SubjectIdentityRequest)({
        ...request,
        schemaVersion: "worlds.v1",
      })
    ).toBeFalsy();
  });

  it("requires finite valid intervals, explicit nulls and unique manual seeds", () => {
    const request = {
      ...envelope,
      input: { anchors: ["A", "B"], atFrame: null, interval },
      operation: "InspectSubjectIdentity",
    };
    for (const input of [
      { anchors: ["A"], interval },
      { ...request.input, anchors: [] },
      { ...request.input, anchors: ["A", "A"] },
      { ...request.input, anchors: ["A", "B", "C"] },
      { ...request.input, interval: { _tag: "Unknown" } },
      { ...request.input, interval: { ...interval, to: interval.from } },
      { ...request.input, interval: { ...interval, from: "2026-02-30" } },
    ]) {
      expect(
        Schema.is(SubjectIdentityRequest)({ ...request, input })
      ).toBeFalsy();
    }
    expect(
      Schema.is(SubjectIdentityRequest)({ ...request, operationId: id })
    ).toBeFalsy();
  });

  it("recovery cannot contain a source sample or fabricated empty comparisons", () => {
    expect(Schema.is(IdentityRecoveryFrame)(recovery)).toBeTruthy();
    expect(Schema.is(IdentityFrame)(recovery)).toBeFalsy();
    for (const value of [
      { ...recovery, claims: [] },
      { ...recovery, cells: [{ ...structure, comparisons: [] }] },
      { ...recovery, comparison: "complete" },
      { ...recovery, closureAnchors: ["A", "A"] },
      { ...recovery, cells: [{ ...structure, internalBasis: {} }] },
    ]) {
      expect(Schema.is(IdentityRecoveryFrame)(value)).toBeFalsy();
    }
    expect(
      Schema.is(SubjectIdentitySuccess)({
        _tag: "IdentityRecoveryInspected",
        frame: recovery,
      })
    ).toBeTruthy();
  });

  it("binds blocked choices and unknown to distinct exact consequences", () => {
    expect(Schema.is(IdentityQuestion)(recoveryQuestion)).toBeTruthy();
    for (const value of [
      { ...recoveryQuestion, comparison: "computed" },
      { ...recoveryQuestion, frame: framePointer },
      { ...recoveryQuestion, blockedAlternatives: [] },
      {
        ...recoveryQuestion,
        alternatives: [unknownAlternative, unknownAlternative],
      },
      {
        ...recoveryQuestion,
        alternatives: [{ ...unknownAlternative, effectItems: [assertion] }],
      },
      {
        ...recoveryQuestion,
        alternatives: [
          {
            ...unknownAlternative,
            afterCells: [{ ...structure, comparisons: [] }],
          },
        ],
      },
      {
        ...recoveryQuestion,
        blockedAlternatives: [
          { answer: "confirm", reason: "Guess", supportingRefs: [] },
        ],
      },
    ]) {
      expect(Schema.is(IdentityQuestion)(value)).toBeFalsy();
    }
  });

  it("requires canonical assertion orientation and nonoverlapping partition members", () => {
    expect(Schema.is(AssertIdentity)(assertion)).toBeTruthy();
    expect(
      Schema.is(AssertIdentity)({ ...assertion, left: "B", right: "A" })
    ).toBeFalsy();
    expect(Schema.is(AssertIdentity)({ ...assertion, right: "A" })).toBeFalsy();
    const partition = { blocks: [["A"], ["B"]], cellRef: digest };
    expect(Schema.is(IdentityPartitions)([partition])).toBeTruthy();
    for (const partitions of [
      [],
      [partition, partition],
      [{ ...partition, blocks: [["A"], ["A", "B"]] }],
      [{ ...partition, blocks: [[]] }],
    ]) {
      expect(Schema.is(IdentityPartitions)(partitions)).toBeFalsy();
    }
  });

  it("rejects aggregate overflow, overlapping components and unknown invalidation", () => {
    const members = Array.from({ length: 33 }, (_, index) => `A${index}`);
    expect(
      Schema.is(IdentityPartitions)([
        { blocks: [members.slice(0, 32), members.slice(32)], cellRef: digest },
      ])
    ).toBeFalsy();
    const invalidFrame = {
      ...recovery,
      cells: [
        {
          ...structure,
          components: [
            { members: ["A"], representative: "A" },
            { members: ["A", "B"], representative: "A" },
          ],
        },
      ],
    };
    expect(Schema.is(IdentityRecoveryFrame)(invalidFrame)).toBeFalsy();
    expect(
      Schema.is(SubjectIdentitySuccess)({
        _tag: "IdentityRecoveryInspected",
        frame: invalidFrame,
      })
    ).toBeFalsy();
    expect(
      Schema.is(IdentityQuestion)({
        ...recoveryQuestion,
        alternatives: [
          {
            ...unknownAlternative,
            impact: {
              ...impact,
              pendingCases: "invalidated-by-identity-change",
            },
          },
        ],
      })
    ).toBeFalsy();
    expect(
      Schema.is(IdentityRecoveryFrame)({
        ...recovery,
        cells: [{ ...structure, coveredClaimRefs: [] }],
      })
    ).toBeFalsy();
  });
});
