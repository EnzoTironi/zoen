import { InvalidInput } from "@zoen/contracts/d01/errors";
import {
  AnswerQuestion,
  ProposeCorrection,
  UndoCorrection,
} from "@zoen/contracts/d01/operations";
import { Effect, Schema } from "effect";

import { envelope, newOperationId } from "../../features/d01/requests.ts";
import type { CorrectionContext } from "./model.ts";

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

export const proposeRequest = Effect.fn("web.proposeCorrection")(
  function* proposeRequest(
    state: CorrectionContext,
    from: string,
    to: string,
    choice: string
  ) {
    if (state.frame === null || state.world === null) {
      return yield* invalid();
    }
    return yield* Schema.decodeEffect(ProposeCorrection)({
      ...envelope,
      input: {
        consequence: {
          choice:
            choice === "unknown"
              ? { _tag: "unknown" }
              : { _tag: "selectClaim", claimRef: choice },
          subjectKey: state.frame.subjectKey,
          validTime: { _tag: "DateInterval", from, to },
        },
        frameRef: state.frame.frameRef,
      },
      operation: "ProposeCorrection",
      operationId: yield* newOperationId,
      worldRef: state.world,
    }).pipe(Effect.mapError(invalid));
  }
);

export const answerRequest = Effect.fn("web.answerQuestion")(
  function* answerRequest(
    state: CorrectionContext,
    answer: "confirm" | "unknown"
  ) {
    if (state.proposal === null || state.world === null) {
      return yield* invalid();
    }
    return yield* Schema.decodeEffect(AnswerQuestion)({
      ...envelope,
      input: {
        answer,
        consequenceDigest: state.proposal.consequenceDigest,
        questionRef: state.proposal.questionRef,
      },
      operation: "AnswerQuestion",
      operationId: yield* newOperationId,
      worldRef: state.world,
    }).pipe(Effect.mapError(invalid));
  }
);

export const undoRequest = Effect.fn("web.undoCorrection")(
  function* undoRequest(state: CorrectionContext, correctionRef: string) {
    if (state.frame === null || state.world === null) {
      return yield* invalid();
    }
    return yield* Schema.decodeEffect(UndoCorrection)({
      ...envelope,
      input: { correctionRef, frameRef: state.frame.frameRef },
      operation: "UndoCorrection",
      operationId: yield* newOperationId,
      worldRef: state.world,
    }).pipe(Effect.mapError(invalid));
  }
);
