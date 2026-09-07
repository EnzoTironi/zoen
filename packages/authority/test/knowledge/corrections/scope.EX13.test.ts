import { expect, it } from "@effect/vitest";
import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { CorrectionConsequence } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";

import {
  classifyAnswer,
  validateCorrectionScope,
} from "../../../src/knowledge/corrections/scope.js";

const id = "00000000-0000-4000-8000-000000000001";
const frame = Schema.decodeSync(VisibleFrame)({
  claims: [
    {
      claimRef: id,
      evidenceRef: id,
      predicate: "obligation.amount",
      recordId: "record",
      recordIndex: 0,
      source: {
        externalId: "source",
        label: "Source",
        namespace: "test",
        revision: "1",
      },
      sourceRef: id,
      subjectKey: "A",
      validTime: { _tag: "DateInterval", from: "2026-09-01", to: "2026-11-01" },
      value: { _tag: "Known", amount: "100", currency: "BRL" },
      verification: "unverified",
    },
  ],
  contested: false,
  coverage: { _tag: "Partial" },
  frameRef: id,
  scopedCorrections: [],
  selection: { _tag: "selected", claimRef: id },
  subjectKey: "A",
  verification: "unverified",
  worldRef: { realm: "live", worldId: id },
});
const consequence = Schema.decodeSync(CorrectionConsequence)({
  choice: { _tag: "selectClaim", claimRef: id },
  subjectKey: "A",
  validTime: { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" },
});

it.effect(
  "EX13 confirm preserves exact consequence while unknown cannot select a source",
  () =>
    Effect.gen(function* answerKinds() {
      expect(yield* classifyAnswer(consequence, "confirm")).toStrictEqual(
        consequence
      );
      expect(yield* classifyAnswer(consequence, "unknown")).toStrictEqual({
        ...consequence,
        choice: { _tag: "unknown" },
      });
    })
);
it.effect(
  "EX13 correction scope requires the actual subject, known selected claim and a covered civil interval",
  () =>
    Effect.gen(function* containedScope() {
      expect(yield* validateCorrectionScope(frame, consequence)).toStrictEqual(
        consequence
      );
      expect(
        yield* validateCorrectionScope(frame, {
          ...consequence,
          subjectKey: yield* Schema.decodeEffect(
            CorrectionConsequence.fields.subjectKey
          )("B"),
        }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
      expect(
        yield* validateCorrectionScope(frame, {
          ...consequence,
          validTime: {
            ...consequence.validTime,
            from: yield* Schema.decodeEffect(
              CorrectionConsequence.fields.validTime.fields.from
            )("2026-08-01"),
          },
        }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
      const unknown = yield* Schema.decodeEffect(VisibleFrame)({
        ...frame,
        claims: frame.claims.map((claim) => ({
          ...claim,
          value: { _tag: "Unknown" },
        })),
      });
      expect(
        yield* validateCorrectionScope(unknown, consequence).pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
    })
);
it.effect(
  "EX13 equal and disjoint decision scopes are allowed; partial overlaps are explicitly unsupported",
  () =>
    Effect.gen(function* scopeOverlap() {
      const decided = yield* Schema.decodeEffect(VisibleFrame)({
        ...frame,
        scopedCorrections: [
          {
            ...consequence,
            authoredBy: "current-principal",
            correctionRef: id,
            receiptRef: id,
          },
        ],
      });
      expect(
        yield* validateCorrectionScope(decided, consequence)
      ).toStrictEqual(consequence);
      const october = yield* Schema.decodeEffect(CorrectionConsequence)({
        ...consequence,
        validTime: {
          _tag: "DateInterval",
          from: "2026-10-01",
          to: "2026-11-01",
        },
      });
      expect(yield* validateCorrectionScope(decided, october)).toStrictEqual(
        october
      );
      const overlap = yield* Schema.decodeEffect(CorrectionConsequence)({
        ...consequence,
        validTime: {
          _tag: "DateInterval",
          from: "2026-09-15",
          to: "2026-10-15",
        },
      });
      expect(
        yield* validateCorrectionScope(decided, overlap).pipe(Effect.flip)
      ).toMatchObject({ _tag: "Unsupported" });
    })
);
