import { Schema } from "effect";

import { SemanticError } from "../worlds/errors.js";
import {
  OperationId,
  Purpose,
  ReceiptRef,
  Revision,
  WorldRef,
  exact,
} from "../worlds/values.js";
import {
  ErasureAttemptExternalState,
  ErasureAttestationScope,
  ErasureRestoreAfterErasure,
  ErasureSchemaVersion,
  WorldErasurePhase,
} from "./values.js";

const envelope = {
  purpose: Purpose,
  schemaVersion: ErasureSchemaVersion,
  worldRef: WorldRef,
};
const mutation = { ...envelope, operationId: OperationId };

/** Owner requests World-scoped erasure; server derives prefixes — never client prefixes. */
export const RequestWorldErasure = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    confirmEntireWorld: Schema.Literal(true),
    expectedErasureRevision: Schema.NullOr(Revision),
    policyVersion: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(128)
    ),
  }).annotate(exact),
  operation: Schema.Literal("RequestWorldErasure"),
}).annotate(exact);

/** Narrow administrative progress after Closing — not content disclosure. */
export const InspectWorldErasure = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    operationId: Schema.NullOr(OperationId),
  }).annotate(exact),
  operation: Schema.Literal("InspectWorldErasure"),
}).annotate(exact);

/**
 * Advance Closing→Erased for local controlled copies (SQL + World object prefix).
 * Does not mutate the immutable Closing receipt; Inspect shows current phase.
 */
export const PurgeWorldContent = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    closingOperationId: OperationId,
    expectedErasureRevision: Revision,
  }).annotate(exact),
  operation: Schema.Literal("PurgeWorldContent"),
}).annotate(exact);

export const WorldErasureRequest = Schema.Union([
  RequestWorldErasure,
  InspectWorldErasure,
  PurgeWorldContent,
]);
export type WorldErasureRequest = typeof WorldErasureRequest.Type;

export const WorldErasureRequested = Schema.TaggedStruct(
  "WorldErasureRequested",
  {
    attemptExternalState: ErasureAttemptExternalState,
    phase: WorldErasurePhase,
    policyVersion: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(128)
    ),
    receiptRef: ReceiptRef,
    restoreAfterErasure: ErasureRestoreAfterErasure,
    revision: Revision,
    worldRef: WorldRef,
  }
).annotate(exact);

export const WorldErasureInspected = Schema.TaggedStruct(
  "WorldErasureInspected",
  {
    attemptExternalState: ErasureAttemptExternalState,
    phase: WorldErasurePhase,
    restoreAfterErasure: ErasureRestoreAfterErasure,
    revision: Revision,
    worldRef: WorldRef,
  }
).annotate(exact);

export const WorldContentPurged = Schema.TaggedStruct("WorldContentPurged", {
  attemptExternalState: ErasureAttemptExternalState,
  attestationScope: ErasureAttestationScope,
  objectVersionsRemoved: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(1_000_000)
  ),
  phase: WorldErasurePhase,
  policyVersion: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  receiptRef: ReceiptRef,
  restoreAfterErasure: ErasureRestoreAfterErasure,
  revision: Revision,
  sqlContentPurged: Schema.Boolean,
  worldRef: WorldRef,
}).annotate(exact);

export const WorldErasureSuccess = Schema.Union([
  WorldErasureRequested,
  WorldErasureInspected,
  WorldContentPurged,
]);
export type WorldErasureSuccess = typeof WorldErasureSuccess.Type;

export const WorldErasureFailure = SemanticError;
export type WorldErasureFailure = typeof WorldErasureFailure.Type;
