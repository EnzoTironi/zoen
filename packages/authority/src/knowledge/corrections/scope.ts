import { InvalidInput, Unsupported } from "@zoen/contracts/d01/errors";
import { VisibleFrame } from "@zoen/contracts/d01/evidence";
import {
  CorrectionConsequence,
  QuestionAnswer,
} from "@zoen/contracts/d01/operations";
import type { DateInterval } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

export const sameInterval = (
  left: typeof DateInterval.Type,
  right: typeof DateInterval.Type
): boolean => left.from === right.from && left.to === right.to;

export const validateCorrectionScope = Effect.fn(
  "authority.corrections.validateCorrectionScope"
)(
  function* validateCorrectionScope(
    frameInput: VisibleFrame,
    consequenceInput: typeof CorrectionConsequence.Type
  ) {
    const frame = yield* Schema.decodeEffect(VisibleFrame)(frameInput);
    const consequence = yield* Schema.decodeEffect(CorrectionConsequence)(
      consequenceInput
    );
    if (frame.subjectKey !== consequence.subjectKey) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const { from, to } = consequence.validTime;
    const { choice } = consequence;
    const scoped = frame.claims.filter(
      (claim) =>
        claim.subjectKey === consequence.subjectKey &&
        claim.validTime._tag === "DateInterval" &&
        claim.validTime.from <= from &&
        claim.validTime.to >= to
    );
    if (
      scoped.length === 0 ||
      (choice._tag === "selectClaim" &&
        !scoped.some(
          (claim) =>
            claim.claimRef === choice.claimRef && claim.value._tag === "Known"
        ))
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    if (
      frame.scopedCorrections.some(
        (decision) =>
          decision.validTime.from < to &&
          from < decision.validTime.to &&
          !sameInterval(decision.validTime, consequence.validTime)
      )
    ) {
      return yield* new Unsupported({ code: "UNSUPPORTED" });
    }
    return consequence;
  },
  Effect.catchTag(
    "SchemaError",
    () => new InvalidInput({ code: "INVALID_INPUT" })
  )
);

export const classifyAnswer = Effect.fn("authority.corrections.classifyAnswer")(
  function* classifyAnswer(
    consequenceInput: typeof CorrectionConsequence.Type,
    answerInput: typeof QuestionAnswer.Type
  ) {
    const consequence = yield* Schema.decodeEffect(CorrectionConsequence)(
      consequenceInput
    );
    const answer = yield* Schema.decodeEffect(QuestionAnswer)(answerInput);
    return answer === "confirm"
      ? consequence
      : { ...consequence, choice: { _tag: "unknown" } as const };
  },
  Effect.catchTag(
    "SchemaError",
    () => new InvalidInput({ code: "INVALID_INPUT" })
  )
);
