import { Schema } from "effect";

import {
  OperationId,
  Purpose,
  ReceiptRef,
  Revision,
  WorldRef,
  exact,
} from "../d01/values.js";

export const PrincipalRef = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/PrincipalRef")
);
export type PrincipalRef = typeof PrincipalRef.Type;
const membership = { principalRef: PrincipalRef, revision: Revision };
export const Membership = Schema.Struct({
  ...membership,
  role: Schema.Literals(["owner", "viewer"]),
  state: Schema.Literals(["active", "revoked"]),
}).annotate(exact);
export type Membership = typeof Membership.Type;
const envelope = {
  purpose: Purpose,
  schemaVersion: Schema.Literal("d03.sharing.v1"),
  worldRef: WorldRef,
};
export const InspectWorldAccess = Schema.Struct({
  ...envelope,
  input: Schema.Struct({ principalRef: Schema.NullOr(PrincipalRef) }).annotate(
    exact
  ),
  operation: Schema.Literal("InspectWorldAccess"),
}).annotate(exact);
export const GrantWorldReadAccess = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    expectedRevision: Schema.NullOr(Revision),
    principalRef: PrincipalRef,
  }).annotate(exact),
  operation: Schema.Literal("GrantWorldReadAccess"),
  operationId: OperationId,
}).annotate(exact);
export const RevokeWorldReadAccess = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    expectedRevision: Revision,
    principalRef: PrincipalRef,
  }).annotate(exact),
  operation: Schema.Literal("RevokeWorldReadAccess"),
  operationId: OperationId,
}).annotate(exact);
export const SharingRequest = Schema.Union([
  InspectWorldAccess,
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
]);
export type SharingRequest = typeof SharingRequest.Type;
export const WorldAccessInspected = Schema.TaggedStruct(
  "WorldAccessInspected",
  {
    membership: Schema.NullOr(Membership),
    worldRef: WorldRef,
  }
).annotate(exact);
export const WorldReadAccessGranted = Schema.TaggedStruct(
  "WorldReadAccessGranted",
  {
    membershipAtCommit: Schema.Struct({
      ...membership,
      role: Schema.Literal("viewer"),
      state: Schema.Literal("active"),
    }).annotate(exact),
    receiptRef: ReceiptRef,
    worldRef: WorldRef,
  }
).annotate(exact);
export const WorldReadAccessRevoked = Schema.TaggedStruct(
  "WorldReadAccessRevoked",
  {
    membershipAtCommit: Schema.Struct({
      ...membership,
      role: Schema.Literal("viewer"),
      state: Schema.Literal("revoked"),
    }).annotate(exact),
    receiptRef: ReceiptRef,
    worldRef: WorldRef,
  }
).annotate(exact);
export const SharingMutationSuccess = Schema.Union([
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
]);
export const SharingSuccess = Schema.Union([
  WorldAccessInspected,
  SharingMutationSuccess,
]);
export type SharingSuccess = typeof SharingSuccess.Type;
