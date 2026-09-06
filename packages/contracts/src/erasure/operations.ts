import { Schema } from "effect";

import { D01Error } from "../d01/errors.js";
import {
  OperationId,
  Purpose,
  ReceiptRef,
  Revision,
  WorldRef,
  exact,
} from "../d01/values.js";
import {
  ErasureAttemptExternalState,
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

export const WorldErasureRequest = Schema.Union([
  RequestWorldErasure,
  InspectWorldErasure,
]);
export type WorldErasureRequest = typeof WorldErasureRequest.Type;

export const WorldErasureRequested = Schema.TaggedStruct("WorldErasureRequested", {
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
}).annotate(exact);

export const WorldErasureInspected = Schema.TaggedStruct("WorldErasureInspected", {
  attemptExternalState: ErasureAttemptExternalState,
  phase: WorldErasurePhase,
  restoreAfterErasure: ErasureRestoreAfterErasure,
  revision: Revision,
  worldRef: WorldRef,
}).annotate(exact);

export const WorldErasureSuccess = Schema.Union([
  WorldErasureRequested,
  WorldErasureInspected,
]);
export type WorldErasureSuccess = typeof WorldErasureSuccess.Type;

export const WorldErasureFailure = D01Error;
export type WorldErasureFailure = typeof WorldErasureFailure.Type;
