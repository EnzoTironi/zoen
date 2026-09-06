import { Schema } from "effect";

import { exact } from "../d01/values.js";

/** Candidate profile for NEW Worlds only; retained Worlds stay d01-local-retained-v1. */
export const ErasurePolicyProfileId = Schema.Literal("d03-local-erasable-v1");
export type ErasurePolicyProfileId = typeof ErasurePolicyProfileId.Type;

export const ErasureSchemaVersion = Schema.Literal("erasure.v1");
export type ErasureSchemaVersion = typeof ErasureSchemaVersion.Type;

/** Local World lifecycle after an authorized Closing decision. */
export const WorldErasurePhase = Schema.Literals([
  "Active",
  "Closing",
  "Suppressed",
  "Purging",
  "Erased",
  "Blocked",
  "Unknown",
]);
export type WorldErasurePhase = typeof WorldErasurePhase.Type;

/** External attempt register terminality (outside app rollback). */
export const ErasureAttemptExternalState = Schema.Literals([
  "Registered",
  "Confirmed",
  "Aborted",
  "Unknown",
]);
export type ErasureAttemptExternalState =
  typeof ErasureAttemptExternalState.Type;

/**
 * Explicit product default from the freeze: restore-after-erasure stays closed
 * until a qualified controller + copy catalog exist.
 */
export const ErasureRestoreAfterErasure = Schema.Literal(false).annotate(exact);
