import { Conflict, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { ErasureObjectInventory } from "../../ports/erasure/inventory.js";
import { requireSettledObjectWriters } from "./object-write-settlement.js";

/**
 * Refuse captures that can still finish a remote PUT (`reserved`) or are mid-cleanup
 * (`cleanup_pending`). Durable `removed` rows cannot stage uploads and are deleted only
 * during SQL purge — treating them as unsettled would block Erased forever.
 */
export const requireSettledCaptures = Effect.fn(
  "erasure.requireSettledCaptures"
)(function* requireSettledCaptures(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  const uncertain = yield* sql`
      SELECT capture_id FROM jobs.captures
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND state IN ('reserved', 'cleanup_pending') LIMIT 1
    `;
  if (uncertain.length !== 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});

/**
 * ZA-10: captures + object-write ledger + multipart inventory must be settled
 * before purge completion. HEAD 404 is not consulted here.
 */
export const requireSettledExternalWriters = Effect.fn(
  "erasure.requireSettledExternalWriters"
)(function* requireSettledExternalWriters(world: WorldRef) {
  yield* requireSettledCaptures(world);
  yield* requireSettledObjectWriters(world);
  const inventory = yield* ErasureObjectInventory;
  const multipart = yield* inventory.listWorldMultipartUploads(world);
  if (multipart.uploads.length !== 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});

/**
 * After version purge: versions empty, multipart empty, writers settled.
 * Keeps purgeWorldContent below the complexity budget.
 */
export const requireEmptyObjectSurface = Effect.fn(
  "erasure.requireEmptyObjectSurface"
)(function* requireEmptyObjectSurface(world: WorldRef) {
  const inventory = yield* ErasureObjectInventory;
  const after = yield* inventory.listWorldVersions(world);
  if (after.entries.length > 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  const afterMultipart = yield* inventory.listWorldMultipartUploads(world);
  if (afterMultipart.uploads.length > 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  yield* requireSettledExternalWriters(world);
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
    yield* requireSettledObjectWriters(input.world);
    yield* requireSettledCaptures(input.world);
    return yield* Effect.void;
  }
);
