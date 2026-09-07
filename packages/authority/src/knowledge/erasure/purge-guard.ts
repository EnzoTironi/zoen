import { Conflict, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Expiry and cleanup's `removed` state do not prove that a remote PUT cannot finish. */
export const requireSettledCaptures = Effect.fn(
  "erasure.requireSettledCaptures"
)(function* requireSettledCaptures(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  const uncertain = yield* sql`
      SELECT capture_id FROM jobs.captures
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND state NOT IN ('uploaded', 'admitted') LIMIT 1
    `;
  if (uncertain.length !== 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});

/** Inside the receipt transaction; all expected fields belong to the observed Closing. */
export const lockPurgingProgress = Effect.fn("erasure.lockPurgingProgress")(
  function* lockPurgingProgress(input: {
    readonly world: WorldRef;
    readonly closingOperationId: string;
    readonly closingReceiptId: string;
    readonly revision: string;
    readonly policyVersion: string;
  }) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT world_id FROM authority.world_erasure_progress
      WHERE world_id = ${input.world.worldId} AND realm = ${input.world.realm}
        AND phase = 'Purging' AND erasure_revision = ${input.revision}
        AND closing_operation_id = ${input.closingOperationId}
        AND closing_receipt_id = ${input.closingReceiptId}
        AND policy_version = ${input.policyVersion}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    yield* requireSettledCaptures(input.world);
    return yield* Effect.void;
  }
);
