import { randomUUID } from "node:crypto";

import {
  InvalidInput,
  NotFoundOrDenied,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import {
  CorrectionUndone,
  UndoCorrection,
} from "@zoen/contracts/d01/operations";
import { CaseRef, CorrectionRef, Revision } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { bindWorldIntent } from "../../commit/intent.js";
import { commitMutation, readMutationReplay } from "../../commit/mutation.js";
import { DomainKey } from "../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CorrectionAnswer } from "../../ports/d01/persistence.js";
import { canonicalJson } from "../../values/canonical.js";
import { loadCorrectionFrame } from "./frame.js";
import { readScopedCorrections } from "./projection.js";

export const undoCorrection = Effect.fn("authority.corrections.undo")(
  function* undoCorrection(
    context: VerifiedRequestContext,
    input: typeof UndoCorrection.Type
  ) {
    const request = yield* Schema.decodeEffect(UndoCorrection)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(CorrectionUndone)(replay);
    }
    const saved = yield* loadCorrectionFrame(
      context,
      request.worldRef,
      request.input.frameRef
    );
    const correctionRef =
      yield* Schema.decodeEffect(CorrectionRef)(randomUUID());
    const sql = yield* SqlClient.SqlClient;
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef, cut) =>
        Effect.gen(function* appendRetraction() {
          if (
            !saved.visible_frame.scopedCorrections.some(
              (decision) =>
                decision.correctionRef === request.input.correctionRef
            )
          ) {
            return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
          }
          const active = yield* readScopedCorrections(
            context,
            request.worldRef,
            saved.visible_frame.subjectKey
          );
          if (
            !active.some(
              (decision) =>
                decision.correctionRef === request.input.correctionRef
            )
          ) {
            return yield* new Stale({ code: "STALE" });
          }
          const [row] =
            yield* sql`SELECT e.case_id FROM authority.corrections e JOIN authority.cases c USING (world_id, realm, case_id)
          WHERE e.world_id = ${request.worldRef.worldId} AND e.realm = ${request.worldRef.realm} AND e.correction_id = ${request.input.correctionRef}
            AND c.principal_id = ${context.presence.principalId}`;
          const target = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ case_id: CaseRef })
          )(row);
          const answer = yield* Schema.decodeEffect(CorrectionAnswer)({
            _tag: "Undo",
            correctionRef: request.input.correctionRef,
          });
          const answerJson = yield* canonicalJson(answer);
          const revision = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut.cases) + 1n).toString()
          );
          yield* sql`INSERT INTO authority.corrections (world_id, realm, correction_id, case_id, answer, previous_correction_id, receipt_id, revision)
          VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${correctionRef}, ${target.case_id}, ${answerJson}::jsonb, ${request.input.correctionRef}, ${receiptRef}, ${revision})`;
          return {
            changedDomains: ["cases"] as const,
            result: {
              _tag: "CorrectionUndone" as const,
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
    return yield* Schema.decodeUnknownEffect(CorrectionUndone)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
