import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/d01/errors";
import { CorrectionConsequence } from "@zoen/contracts/d01/operations";
import { CaseRef, FrameRef, SubjectKey } from "@zoen/contracts/d01/values";
import type { QuestionRef, WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { InternalBasis } from "../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CaseState, StoredQuestion } from "../../ports/d01/persistence.js";

const CaseRow = Schema.Struct({
  case_id: CaseRef,
  consequence: CorrectionConsequence,
  frame_id: FrameRef,
  internal_basis: InternalBasis,
  question: StoredQuestion,
  state: CaseState,
  subject_key: SubjectKey,
});

export const readCorrectionCase = Effect.fn("authority.corrections.readCase")(
  function* readCorrectionCase(
    context: VerifiedRequestContext,
    world: WorldRef,
    questionRef: typeof QuestionRef.Type
  ) {
    const sql = yield* SqlClient.SqlClient;
    const [row] =
      yield* sql`SELECT case_id, consequence, frame_id, internal_basis, question, state, subject_key FROM authority.cases
      WHERE world_id = ${world.worldId} AND realm = ${world.realm} AND question_ref = ${questionRef} AND principal_id = ${context.presence.principalId}`;
    if (row === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const value = yield* Schema.decodeUnknownEffect(CaseRow)(row);
    if (
      value.question.questionRef !== questionRef ||
      value.subject_key !== value.consequence.subjectKey
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return value;
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
