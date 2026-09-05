import { randomUUID } from "node:crypto";

import { InvalidInput, Unavailable } from "@zoen/contracts/d01/errors";
import {
  CorrectionProposed,
  ProposeCorrection,
} from "@zoen/contracts/d01/operations";
import { CaseRef, QuestionRef, Revision } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { bindWorldIntent } from "../../commit/intent.js";
import { commitMutation, readMutationReplay } from "../../commit/mutation.js";
import { CurrentInternalBasis, DomainKey } from "../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { StoredQuestion } from "../../ports/d01/persistence.js";
import { canonicalJson, structuredDigest } from "../../values/canonical.js";
import { loadCorrectionFrame } from "./frame.js";
import { validateCorrectionScope } from "./scope.js";

export const proposeCorrection = Effect.fn("authority.corrections.propose")(
  function* proposeCorrection(
    context: VerifiedRequestContext,
    input: typeof ProposeCorrection.Type
  ) {
    const request = yield* Schema.decodeEffect(ProposeCorrection)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(CorrectionProposed)(replay);
    }
    const saved = yield* loadCorrectionFrame(
      context,
      request.worldRef,
      request.input.frameRef
    );
    const caseRef = yield* Schema.decodeEffect(CaseRef)(randomUUID());
    const questionRef = yield* Schema.decodeEffect(QuestionRef)(randomUUID());
    const sql = yield* SqlClient.SqlClient;
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef, cut) =>
        Effect.gen(function* saveProposal() {
          const consequence = yield* validateCorrectionScope(
            saved.visible_frame,
            request.input.consequence
          );
          const consequenceDigest = yield* structuredDigest(
            "correction-consequence",
            { consequence, frameRef: request.input.frameRef }
          );
          const question = yield* Schema.decodeEffect(StoredQuestion)({
            allowedAnswers: ["confirm", "unknown"],
            consequenceDigest,
            questionRef,
            version: "d01.v1",
          });
          const revision = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut.cases) + 1n).toString()
          );
          // Only this proposal's known cases increment changes the retained base.
          // Its read set, meaning and every external dependency remain byte-for-byte bound.
          const basis = yield* Schema.decodeUnknownEffect(CurrentInternalBasis)(
            {
              ...saved.internal_basis,
              cut: { ...saved.internal_basis.cut, cases: revision },
            }
          );
          const basisJson = yield* canonicalJson(basis);
          const questionJson = yield* canonicalJson(question);
          const consequenceJson = yield* canonicalJson(consequence);
          yield* sql`INSERT INTO authority.cases
          (world_id, realm, case_id, principal_id, frame_id, subject_key, state, question_ref, question, consequence, internal_basis, introduced_receipt_id)
          VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${caseRef}, ${context.presence.principalId}, ${request.input.frameRef},
            ${consequence.subjectKey}, 'proposed', ${questionRef}, ${questionJson}::jsonb, ${consequenceJson}::jsonb, ${basisJson}::jsonb, ${receiptRef})`;
          for (const source of basis.readSet.sources) {
            yield* sql`INSERT INTO authority.pins (world_id, realm, evidence_id, owner_kind, owner_id, created_at)
            VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${source.evidenceRef}, 'case', ${caseRef}, clock_timestamp())`;
          }
          return {
            changedDomains: ["cases"] as const,
            result: {
              _tag: "CorrectionProposed" as const,
              caseRef,
              consequence,
              consequenceDigest,
              questionRef,
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
    return yield* Schema.decodeUnknownEffect(CorrectionProposed)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
