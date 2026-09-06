import { randomUUID } from "node:crypto";

import { Unavailable } from "@zoen/contracts/d01/errors";
import { ReceiptRef } from "@zoen/contracts/d01/values";
import type { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { DomainCut } from "../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../ports/d01/context.js";
import { StoredOperationResult } from "../ports/d01/persistence.js";
import { canonicalJson } from "../values/canonical.js";

const resultTags = {
  AnswerQuestion: "CorrectionApplied",
  CreatePersonalWorld: "WorldCreated",
  GrantWorldReadAccess: "WorldReadAccessGranted",
  ImportEvidence: "EvidenceImported",
  ProposeCorrection: "CorrectionProposed",
  ProposeIdentityResolution: "IdentityProposed",
  ProposeIdentitySplit: "IdentityProposed",
  ProposeIdentityUndo: "IdentityProposed",
  ResolveIdentity: "IdentityResolved",
  RequestWorldErasure: "WorldErasureRequested",
  RevokeWorldReadAccess: "WorldReadAccessRevoked",
  UndoCorrection: "CorrectionUndone",
} as const;
type MutationOperation = keyof typeof resultTags;

const resultMatches = (
  operation: MutationOperation,
  result: typeof StoredOperationResult.Type,
  receiptRef: typeof ReceiptRef.Type,
  world: WorldRef
): boolean =>
  result._tag === resultTags[operation] &&
  result.receiptRef === receiptRef &&
  (!("worldRef" in result) ||
    (result.worldRef.worldId === world.worldId &&
      result.worldRef.realm === world.realm));

export const newReceiptRef = Effect.fn("authority.commit.newReceiptRef")(
  function* newReceiptRef() {
    return yield* Schema.decodeEffect(ReceiptRef)(randomUUID()).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);

export const persistReceipt = Effect.fn("authority.commit.persistReceipt")(
  function* persistReceipt(input: {
    readonly context: VerifiedRequestContext;
    readonly worldRef: WorldRef;
    readonly operation: MutationOperation;
    readonly receiptRef: typeof ReceiptRef.Type;
    readonly result: typeof StoredOperationResult.Type;
    readonly cut: DomainCut;
  }) {
    const result = yield* Schema.decodeEffect(StoredOperationResult)(
      input.result
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const cut = yield* Schema.decodeEffect(DomainCut)(input.cut).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (
      !resultMatches(input.operation, result, input.receiptRef, input.worldRef)
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const resultJson = yield* canonicalJson(result);
    const cutJson = yield* canonicalJson(cut);
    const sql = yield* SqlClient.SqlClient;
    yield* sql`
      INSERT INTO authority.receipts
        (world_id, realm, receipt_id, principal_id, operation, commit_id,
         committed_at, result, touched_domains)
      VALUES (${input.worldRef.worldId}, ${input.worldRef.realm},
        ${input.receiptRef}, ${input.context.presence.principalId},
        ${input.operation}, ${randomUUID()}, clock_timestamp(),
        ${resultJson}::jsonb, ${cutJson}::jsonb)
    `;
    yield* sql`
      INSERT INTO jobs.outbox
        (world_id, realm, outbox_id, receipt_id, state, fence,
         lease_owner, lease_until, event_kind, payload_ref)
      VALUES (${input.worldRef.worldId}, ${input.worldRef.realm},
        ${randomUUID()}, ${input.receiptRef}, 'pending', 0,
        NULL, NULL, 'semantic-committed', ${input.receiptRef})
    `;
    return result;
  }
);

export const readReceipt = Effect.fn("authority.commit.readReceipt")(
  function* readReceipt(
    context: VerifiedRequestContext,
    world: WorldRef,
    receiptRef: typeof ReceiptRef.Type,
    operation: MutationOperation
  ) {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql`
      SELECT result FROM authority.receipts
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND receipt_id = ${receiptRef}
        AND principal_id = ${context.presence.principalId}
        AND operation = ${operation}
    `;
    if (row === undefined) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const parsed = yield* Schema.decodeUnknownEffect(
      Schema.Struct({ result: StoredOperationResult })
    )(row).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (!resultMatches(operation, parsed.result, receiptRef, world)) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return parsed.result;
  }
);
