import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { VisibleFrame } from "@zoen/contracts/d01/evidence";
import { CorrectionProposed } from "@zoen/contracts/d01/operations";
import { Effect, Schema } from "effect";

import { correctionPatch } from "../../../src/integration/d02/model.ts";
import {
  answerRequest,
  proposeRequest,
  undoRequest,
} from "../../../src/integration/d02/requests.ts";

const frame = Schema.decodeSync(VisibleFrame)({
  claims: [],
  contested: false,
  coverage: { _tag: "Unknown" },
  frameRef: randomUUID(),
  scopedCorrections: [],
  selection: { _tag: "unknown" },
  subjectKey: "invoice-1",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});
const context = { frame, proposal: null, world: frame.worldRef };

it.effect(
  "EX14 refuses an invalid interval and requires a visible frame context before proposing",
  () =>
    Effect.gen(function* invalidProposal() {
      expect(
        yield* proposeRequest(
          context,
          "2026-09-01",
          "2026-09-01",
          "unknown"
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
      expect(
        yield* proposeRequest(
          { ...context, frame: null },
          "2026-09-01",
          "2026-10-01",
          "unknown"
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
    })
);

it.effect(
  "EX14 transports explicit unknown and the server question digest without choosing a source",
  () =>
    Effect.gen(function* explicitUnknown() {
      const proposed = yield* proposeRequest(
        context,
        "2026-09-01",
        "2026-10-01",
        "unknown"
      );
      expect(proposed.input).toStrictEqual({
        consequence: {
          choice: { _tag: "unknown" },
          subjectKey: frame.subjectKey,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
        },
        frameRef: frame.frameRef,
      });
      const proposal = yield* Schema.decodeEffect(CorrectionProposed)({
        _tag: "CorrectionProposed",
        caseRef: randomUUID(),
        consequence: proposed.input.consequence,
        consequenceDigest: "a".repeat(64),
        questionRef: randomUUID(),
        receiptRef: randomUUID(),
      });
      const answered = yield* answerRequest(
        { ...context, proposal },
        "unknown"
      );
      expect(answered.input).toStrictEqual({
        answer: "unknown",
        consequenceDigest: proposal.consequenceDigest,
        questionRef: proposal.questionRef,
      });
      expect(answered.worldRef).toStrictEqual(frame.worldRef);
      expect(correctionPatch(proposal)).toMatchObject({ proposal });
    })
);

it.effect(
  "EX14 undo is bound to the displayed frame and distinct explicit intentions receive distinct IDs",
  () =>
    Effect.gen(function* undoContext() {
      const correction = randomUUID();
      const first = yield* undoRequest(context, correction);
      const second = yield* undoRequest(context, correction);
      expect(first.input).toStrictEqual({
        correctionRef: correction,
        frameRef: frame.frameRef,
      });
      expect(first.worldRef).toStrictEqual(frame.worldRef);
      expect(first.operationId).not.toBe(second.operationId);
    })
);
