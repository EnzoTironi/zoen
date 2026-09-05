import { randomUUID } from "node:crypto";

import {
  Conflict,
  InvalidInput,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import {
  AnswerQuestion,
  CorrectionApplied,
} from "@zoen/contracts/d01/operations";
import { CorrectionRef, Revision } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../access/world.js";
import { bindWorldIntent } from "../../commit/intent.js";
import { commitMutation, readMutationReplay } from "../../commit/mutation.js";
import { DomainKey } from "../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CorrectionAnswer } from "../../ports/d01/persistence.js";
import { canonicalJson, structuredDigest } from "../../values/canonical.js";
import { readCorrectionCase } from "./case.js";
import { readScopedCorrections } from "./projection.js";
import { sameInterval } from "./scope.js";

export const answerQuestion = Effect.fn("authority.corrections.answer")(
  function* answerQuestion(
    context: VerifiedRequestContext,
    input: typeof AnswerQuestion.Type
  ) {
    const request = yield* Schema.decodeEffect(AnswerQuestion)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(CorrectionApplied)(replay);
    }
    yield* authorizeWorld(context, request.worldRef);
    const saved = yield* readCorrectionCase(
      context,
      request.worldRef,
      request.input.questionRef
    );
    const correctionRef =
      yield* Schema.decodeEffect(CorrectionRef)(randomUUID());
    const sql = yield* SqlClient.SqlClient;
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef, cut) =>
        Effect.gen(function* commitAnswer() {
          const current = yield* readCorrectionCase(
            context,
            request.worldRef,
            request.input.questionRef
          );
          const digest = yield* structuredDigest("correction-consequence", {
            consequence: current.consequence,
            frameRef: current.frame_id,
          });
          if (
            current.state !== "proposed" ||
            digest !== current.question.consequenceDigest ||
            digest !== request.input.consequenceDigest ||
            !current.question.allowedAnswers.includes(request.input.answer)
          ) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          const active = yield* readScopedCorrections(
            context,
            request.worldRef,
            current.subject_key
          );
          const previous = active.find((decision) =>
            sameInterval(decision.validTime, current.consequence.validTime)
          );
          const answer = yield* Schema.decodeEffect(CorrectionAnswer)({
            _tag: "Answer",
            answer: request.input.answer,
            consequence: current.consequence,
          });
          const answerJson = yield* canonicalJson(answer);
          const revision = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut.cases) + 1n).toString()
          );
          yield* sql`INSERT INTO authority.corrections (world_id, realm, correction_id, case_id, answer, previous_correction_id, receipt_id, revision)
          VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${correctionRef}, ${current.case_id}, ${answerJson}::jsonb,
            ${previous?.correctionRef ?? null}, ${receiptRef}, ${revision})`;
          yield* sql`UPDATE authority.cases SET state = 'applied' WHERE world_id = ${request.worldRef.worldId} AND realm = ${request.worldRef.realm} AND case_id = ${current.case_id}`;
          return {
            changedDomains: ["cases"] as const,
            result: {
              _tag: "CorrectionApplied" as const,
              correctionRef,
              receiptRef,
            },
          };
        }).pipe(
          Effect.catchTag(
            "SchemaError",
            () => new Unavailable({ code: "UNAVAILABLE" })
          )
        ),
      basis: saved.internal_basis,
      domains: DomainKey.literals,
    });
    return yield* Schema.decodeUnknownEffect(CorrectionApplied)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
