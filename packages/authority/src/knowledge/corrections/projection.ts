import { QuotaExceeded, Unavailable } from "@zoen/contracts/d01/errors";
import { ScopedCorrection } from "@zoen/contracts/d01/evidence";
import {
  CorrectionRef,
  D01_LIMITS,
  ReceiptRef,
} from "@zoen/contracts/d01/values";
import type { SubjectKey, WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CorrectionAnswer } from "../../ports/d01/persistence.js";
import { classifyAnswer } from "./scope.js";

const EffectiveRow = Schema.Struct({
  answer: CorrectionAnswer,
  correction_id: CorrectionRef,
  receipt_id: ReceiptRef,
});

/** Called inside the same snapshot as claims/cut; no current data is mixed into a retained Frame. */
export const readScopedCorrections = Effect.fn(
  "authority.corrections.readScopedCorrections"
)(
  function* readScopedCorrections(
    context: VerifiedRequestContext,
    world: WorldRef,
    subjectKey: typeof SubjectKey.Type
  ) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      WITH latest AS (
        SELECT DISTINCT ON (c.consequence->'validTime'->>'from', c.consequence->'validTime'->>'to')
          e.correction_id, e.answer, e.previous_correction_id
        FROM authority.corrections e JOIN authority.cases c USING (world_id, realm, case_id)
        WHERE e.world_id = ${world.worldId} AND e.realm = ${world.realm}
          AND c.principal_id = ${context.presence.principalId} AND c.subject_key = ${subjectKey}
        ORDER BY c.consequence->'validTime'->>'from', c.consequence->'validTime'->>'to', e.revision DESC
      ), effective AS (
        SELECT CASE WHEN latest.answer->>'_tag' = 'Answer' THEN latest.correction_id
          ELSE target.previous_correction_id END AS correction_id
        FROM latest LEFT JOIN authority.corrections target
          ON target.world_id = ${world.worldId} AND target.realm = ${world.realm}
          AND target.correction_id = latest.previous_correction_id
      )
      SELECT e.answer, e.correction_id, e.receipt_id FROM effective
      JOIN authority.corrections e ON e.world_id = ${world.worldId} AND e.realm = ${world.realm}
        AND e.correction_id = effective.correction_id
      ORDER BY e.answer->'consequence'->'validTime'->>'from', e.answer->'consequence'->'validTime'->>'to'
      LIMIT ${D01_LIMITS.frameClaims + 1}
    `;
    if (rows.length > D01_LIMITS.frameClaims) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    const decisions: ScopedCorrection[] = [];
    for (const row of rows) {
      const event = yield* Schema.decodeUnknownEffect(EffectiveRow)(row);
      if (
        event.answer._tag !== "Answer" ||
        event.answer.consequence.subjectKey !== subjectKey
      ) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      decisions.push(
        yield* Schema.decodeEffect(ScopedCorrection)({
          ...(yield* classifyAnswer(
            event.answer.consequence,
            event.answer.answer
          )),
          authoredBy: "current-principal",
          correctionRef: event.correction_id,
          receiptRef: event.receipt_id,
        })
      );
    }
    return decisions;
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
