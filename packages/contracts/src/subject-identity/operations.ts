import { Schema } from "effect";

import { D01Error } from "../worlds/errors.js";
import {
  CaseRef,
  DateInterval,
  Digest,
  FrameRef,
  OperationId,
  Purpose,
  QuestionRef,
  ReceiptRef,
  SubjectKey,
  WorldRef,
  exact,
} from "../worlds/values.js";
import {
  IdentityControlFramePointer,
  IdentityFrame,
  IdentityFramePointer,
  IdentityRecoveryFrame,
} from "./frame.js";
import { IdentityPartitions, IdentityQuestion } from "./question.js";
import {
  IdentityAnswer,
  IdentityDecisionRef,
  IdentitySeeds,
  SubjectIdentityVersion,
} from "./values.js";

const envelope = {
  purpose: Purpose,
  schemaVersion: SubjectIdentityVersion,
  worldRef: WorldRef,
};
const mutation = { ...envelope, operationId: OperationId };
export const InspectSubjectIdentity = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    anchors: IdentitySeeds,
    atFrame: Schema.NullOr(FrameRef),
    interval: DateInterval,
  }).annotate(exact),
  operation: Schema.Literal("InspectSubjectIdentity"),
}).annotate(exact);
export const InspectIdentityRecovery = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    anchor: SubjectKey,
    atFrame: Schema.NullOr(FrameRef),
    interval: DateInterval,
    targetDecisionRef: Schema.NullOr(IdentityDecisionRef),
  }).annotate(exact),
  operation: Schema.Literal("InspectIdentityRecovery"),
}).annotate(exact);
export const ProposeIdentityResolution = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    frame: IdentityFramePointer,
    left: SubjectKey,
    right: SubjectKey,
  })
    .check(Schema.makeFilter((value) => value.left !== value.right))
    .annotate(exact),
  operation: Schema.Literal("ProposeIdentityResolution"),
}).annotate(exact);
export const ProposeIdentitySplit = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    anchor: SubjectKey,
    frame: IdentityControlFramePointer,
    partitionsByCell: IdentityPartitions,
  }).annotate(exact),
  operation: Schema.Literal("ProposeIdentitySplit"),
}).annotate(exact);
export const ProposeIdentityUndo = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    frame: IdentityControlFramePointer,
    targetDecisionRef: IdentityDecisionRef,
  }).annotate(exact),
  operation: Schema.Literal("ProposeIdentityUndo"),
}).annotate(exact);
export const ResolveIdentity = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    answer: IdentityAnswer,
    consequenceDigest: Digest,
    questionRef: QuestionRef,
  }).annotate(exact),
  operation: Schema.Literal("ResolveIdentity"),
}).annotate(exact);
export const SubjectIdentityRequest = Schema.Union([
  InspectSubjectIdentity,
  InspectIdentityRecovery,
  ProposeIdentityResolution,
  ProposeIdentitySplit,
  ProposeIdentityUndo,
  ResolveIdentity,
]);
export type SubjectIdentityRequest = typeof SubjectIdentityRequest.Type;
export const decodeSubjectIdentityRequest = Schema.decodeUnknownEffect(
  SubjectIdentityRequest
);

export const SubjectIdentityInspected = Schema.TaggedStruct(
  "SubjectIdentityInspected",
  { frame: IdentityFrame }
).annotate(exact);
export const IdentityRecoveryInspected = Schema.TaggedStruct(
  "IdentityRecoveryInspected",
  { frame: IdentityRecoveryFrame }
).annotate(exact);
export const IdentityProposed = Schema.TaggedStruct("IdentityProposed", {
  question: IdentityQuestion,
  receiptRef: ReceiptRef,
}).annotate(exact);
const resolved = {
  caseRef: CaseRef,
  questionRef: QuestionRef,
  receiptRef: ReceiptRef,
};
export const IdentityResolved = Schema.Union([
  Schema.TaggedStruct("IdentityResolved", {
    ...resolved,
    answer: Schema.Literals(["same-as", "different-from", "confirm"]),
    decisionRef: IdentityDecisionRef,
    outcome: Schema.Literal("applied"),
  }).annotate(exact),
  Schema.TaggedStruct("IdentityResolved", {
    ...resolved,
    answer: Schema.Literals(["same-as", "different-from"]),
    decisionRef: Schema.Null,
    outcome: Schema.Literal("reaffirmed"),
  }).annotate(exact),
  Schema.TaggedStruct("IdentityResolved", {
    ...resolved,
    answer: Schema.Literal("unknown"),
    decisionRef: Schema.Null,
    outcome: Schema.Literal("unknown"),
  }).annotate(exact),
]);
export const SubjectIdentitySuccess = Schema.Union([
  SubjectIdentityInspected,
  IdentityRecoveryInspected,
  IdentityProposed,
  IdentityResolved,
]);
export type SubjectIdentitySuccess = typeof SubjectIdentitySuccess.Type;
export const SubjectIdentityResult = Schema.Union([
  SubjectIdentitySuccess,
  D01Error,
]);
export type SubjectIdentityResult = typeof SubjectIdentityResult.Type;
