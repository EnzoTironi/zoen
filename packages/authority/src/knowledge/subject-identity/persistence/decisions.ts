import { Unavailable } from "@zoen/contracts/d01/errors";
import type { CaseRef, ReceiptRef, WorldRef } from "@zoen/contracts/d01/values";
import {
  LocalDate,
  Purpose,
  Revision,
  exact,
} from "@zoen/contracts/d01/values";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import { IdentityEffects } from "@zoen/contracts/subject-identity/effects";
import { IdentityDecisionRef } from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { canonicalJson } from "../../../values/canonical.js";
import {
  IdentityDecision,
  IdentityScope,
  projectIdentity,
} from "../pure/events.js";

const DecisionRow = Schema.Struct({
  decision_id: IdentityDecisionRef,
  effect_items: IdentityEffects,
  interval_from: LocalDate,
  interval_to: LocalDate,
  kind: Schema.Literals(["resolution", "split", "undo"]),
  principal_id: PrincipalRef,
  purpose: Purpose,
  realm: Schema.Literal("live"),
  revision: Revision,
  target_decision_id: Schema.NullOr(IdentityDecisionRef),
  world_id: Schema.String.check(Schema.isUUID()),
}).annotate(exact);

export const loadIdentityProjection = Effect.fn(
  "subjectIdentity.loadProjection"
)(
  function* loadIdentityProjection(scope: IdentityScope) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
    SELECT decision_id, principal_id, purpose, kind,
      to_char(interval_from, 'YYYY-MM-DD') AS interval_from,
      to_char(interval_to, 'YYYY-MM-DD') AS interval_to,
      target_decision_id, revision::text AS revision, effect_items,
      world_id, realm
    FROM authority.identity_decisions
    WHERE world_id = ${scope.worldRef.worldId}
      AND realm = ${scope.worldRef.realm}
      AND principal_id = ${scope.principalRef}
      AND purpose = ${scope.purpose}
    ORDER BY revision ASC
  `;
    const decoded = yield* Schema.decodeUnknownEffect(
      Schema.Array(DecisionRow)
    )(rows).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    const decisions = yield* Effect.forEach(
      Effect.fn("subjectIdentity.decodeDecision")(function* decodeDecision(
        row: typeof DecisionRow.Type
      ) {
        return yield* Schema.decodeEffect(IdentityDecision)({
          authoredBy: row.principal_id,
          decisionRef: row.decision_id,
          effectItems: row.effect_items,
          interval: {
            _tag: "DateInterval",
            from: row.interval_from,
            to: row.interval_to,
          },
          kind: row.kind,
          purpose: row.purpose,
          revision: row.revision,
          targetDecisionRef: row.target_decision_id,
          worldRef: {
            realm: row.realm,
            worldId: row.world_id,
          },
        }).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
      })
    )(decoded);
    return yield* projectIdentity(scope, decisions).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  },
  Effect.catchTag("SqlError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const insertIdentityDecision = Effect.fn(
  "subjectIdentity.insertDecision"
)(function* insertIdentityDecision(input: {
  readonly caseRef: typeof CaseRef.Type;
  readonly decision: IdentityDecision;
  readonly receiptRef: typeof ReceiptRef.Type;
  readonly worldRef: WorldRef;
}) {
  const sql = yield* SqlClient.SqlClient;
  const effectsJson = yield* canonicalJson(input.decision.effectItems);
  yield* sql`
    INSERT INTO authority.identity_decisions (
      world_id, realm, decision_id, principal_id, purpose, kind,
      interval_from, interval_to, target_decision_id, revision,
      effect_items, case_id, receipt_id
    ) VALUES (
      ${input.worldRef.worldId}, ${input.worldRef.realm}, ${input.decision.decisionRef},
      ${input.decision.authoredBy}, ${input.decision.purpose}, ${input.decision.kind},
      ${input.decision.interval.from}::date, ${input.decision.interval.to}::date,
      ${input.decision.targetDecisionRef}, ${input.decision.revision},
      ${effectsJson}::jsonb, ${input.caseRef}, ${input.receiptRef}
    )
  `;
});

export const identityScopeFrom = (
  worldRef: WorldRef,
  principalRef: PrincipalRef,
  purpose: typeof Purpose.Type
) =>
  Schema.decodeSync(IdentityScope)({
    principalRef,
    purpose,
    worldRef,
  });
