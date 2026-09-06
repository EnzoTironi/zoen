import { randomUUID } from "node:crypto";

import {
  Conflict,
  InvalidInput,
  NotFoundOrDenied,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import {
  CaseRef,
  QuestionRef,
  Revision,
  WorldRef,
} from "@zoen/contracts/d01/values";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import {
  IdentityResolved,
  ResolveIdentity,
} from "@zoen/contracts/subject-identity/operations";
import { IdentityQuestion } from "@zoen/contracts/subject-identity/question";
import { IdentityDecisionRef } from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../../access/world.js";
import { bindWorldIntent } from "../../../commit/intent.js";
import {
  commitMutation,
  readMutationReplay,
} from "../../../commit/mutation.js";
import {
  CurrentInternalBasis,
  DomainKey,
  InternalBasis,
} from "../../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../../ports/d01/context.js";
import {
  identityScopeFrom,
  insertIdentityDecision,
  loadIdentityProjection,
} from "../persistence/decisions.js";
import { IdentityDecision, projectIdentity } from "../pure/events.js";

const CaseRow = Schema.Struct({
  case_id: CaseRef,
  internal_basis: InternalBasis,
  question: IdentityQuestion,
  state: Schema.Literals(["proposed", "applied", "blocked", "cancelled"]),
  subject_key: Schema.String,
});

const readIdentityCase = Effect.fn("subjectIdentity.readCase")(
  function* readIdentityCase(
    context: VerifiedRequestContext,
    worldRef: WorldRef,
    questionRef: typeof QuestionRef.Type
  ) {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql`
      SELECT case_id, state, subject_key, question, internal_basis
      FROM authority.cases
      WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
        AND question_ref = ${questionRef}
        AND principal_id = ${context.presence.principalId}
    `;
    if (row === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    return yield* Schema.decodeUnknownEffect(CaseRow)(row).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);

export const resolveIdentity = Effect.fn("subjectIdentity.resolveIdentity")(
  function* resolveIdentity(
    context: VerifiedRequestContext,
    input: typeof ResolveIdentity.Type
  ) {
    const request = yield* Schema.decodeEffect(ResolveIdentity)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const bound = yield* bindWorldIntent(request);
    const replay = yield* readMutationReplay(context, bound);
    if (replay !== null) {
      return yield* Schema.decodeUnknownEffect(IdentityResolved)(replay);
    }
    yield* authorizeWorld(context, request.worldRef);
    const saved = yield* readIdentityCase(
      context,
      request.worldRef,
      request.input.questionRef
    );
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const sql = yield* SqlClient.SqlClient;
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef, cut) =>
        Effect.gen(function* applyAnswer() {
          const current = yield* readIdentityCase(
            context,
            request.worldRef,
            request.input.questionRef
          );
          if (
            current.state !== "proposed" ||
            current.question.consequenceDigest !==
              request.input.consequenceDigest ||
            current.question.questionRef !== request.input.questionRef
          ) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          const alternative = current.question.alternatives.find(
            (item) => item.answer === request.input.answer
          );
          if (alternative === undefined) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          if (
            !("schemaVersion" in current.internal_basis) ||
            current.internal_basis.schemaVersion !== "authority.basis.v2"
          ) {
            return yield* new Stale({ code: "STALE" });
          }
          yield* sql`UPDATE authority.cases SET state = 'applied'
            WHERE world_id = ${request.worldRef.worldId} AND realm = ${request.worldRef.realm}
              AND case_id = ${current.case_id}`;

          if (request.input.answer === "unknown") {
            const result = yield* Schema.decodeUnknownEffect(IdentityResolved)({
              _tag: "IdentityResolved",
              answer: "unknown",
              caseRef: current.case_id,
              decisionRef: null,
              outcome: "unknown",
              questionRef: request.input.questionRef,
              receiptRef,
            });
            return { changedDomains: ["cases"] as const, result };
          }
          if (alternative.effectItems.length === 0) {
            if (
              request.input.answer !== "same-as" &&
              request.input.answer !== "different-from"
            ) {
              return yield* new Conflict({ code: "CONFLICT" });
            }
            const result = yield* Schema.decodeUnknownEffect(IdentityResolved)({
              _tag: "IdentityResolved",
              answer: request.input.answer,
              caseRef: current.case_id,
              decisionRef: null,
              outcome: "reaffirmed",
              questionRef: request.input.questionRef,
              receiptRef,
            });
            return { changedDomains: ["cases"] as const, result };
          }

          const scope = identityScopeFrom(
            request.worldRef,
            principalRef,
            context.purpose
          );
          const projection = yield* loadIdentityProjection(scope);
          const decisionRef =
            yield* Schema.decodeEffect(IdentityDecisionRef)(randomUUID());
          const identityRevision = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut.identity) + 1n).toString()
          );
          const kind =
            current.question.kind === "identity-resolution"
              ? ("resolution" as const)
              : current.question.kind === "identity-split" ||
                  current.question.kind === "identity-recovery-split"
                ? ("split" as const)
                : ("undo" as const);
          const targetDecisionRef =
            kind === "undo" && "targetDecisionRef" in current.question.intent
              ? current.question.intent.targetDecisionRef
              : null;
          const decision = yield* Schema.decodeEffect(IdentityDecision)({
            authoredBy: principalRef,
            decisionRef,
            effectItems: alternative.effectItems,
            interval: current.question.interval,
            kind,
            purpose: context.purpose,
            revision: identityRevision,
            targetDecisionRef,
            worldRef: request.worldRef,
          }).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          // Prospective validation before write.
          yield* projectIdentity(scope, [
            ...projection.decisions,
            decision,
          ]).pipe(Effect.mapError(() => new Conflict({ code: "CONFLICT" })));
          yield* insertIdentityDecision({
            caseRef: current.case_id,
            decision,
            receiptRef,
            worldRef: request.worldRef,
          });
          const result = yield* Schema.decodeUnknownEffect(IdentityResolved)({
            _tag: "IdentityResolved",
            answer: request.input.answer,
            caseRef: current.case_id,
            decisionRef,
            outcome: "applied",
            questionRef: request.input.questionRef,
            receiptRef,
          });
          return { changedDomains: ["cases", "identity"] as const, result };
        }).pipe(
          Effect.catchTag(
            "SchemaError",
            () => new Unavailable({ code: "UNAVAILABLE" })
          )
        ),
      basis: saved.internal_basis,
      domains: DomainKey.literals,
    });
    return yield* Schema.decodeUnknownEffect(IdentityResolved)(result);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
