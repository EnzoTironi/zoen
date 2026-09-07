import { Schema } from "effect";

import {
  WorldErasureRequest,
  WorldErasureSuccess,
} from "../erasure/operations.js";
import {
  EveConversationRequest,
  EveConversationSuccess,
} from "../eve/operations.js";
import { SharingRequest, SharingSuccess } from "../sharing/operations.js";
import {
  SubjectIdentityRequest,
  SubjectIdentitySuccess,
} from "../subject-identity/operations.js";
import { D01Error } from "./errors.js";
import { CorrectionConsequence, VisibleFrame } from "./evidence.js";
import {
  CaseRef,
  CorrectionRef,
  Digest,
  DocumentText,
  EvidenceRef,
  FrameRef,
  OperationId,
  Purpose,
  QuestionRef,
  ReceiptRef,
  SourceRef,
  SubjectKey,
  WorldRef,
  exact,
} from "./values.js";

const envelope = {
  purpose: Purpose,
  schemaVersion: Schema.Literal("worlds.v1"),
};
const mutation = { ...envelope, operationId: OperationId };

export const CreatePersonalWorld = Schema.Struct({
  ...mutation,
  input: Schema.Record(Schema.String, Schema.Never).annotate(exact),
  operation: Schema.Literal("CreatePersonalWorld"),
}).annotate(exact);
export const ImportEvidence = Schema.Struct({
  ...mutation,
  input: Schema.Union([
    Schema.Struct({ document: DocumentText }).annotate(exact),
    Schema.Struct({
      document: DocumentText,
      format: Schema.Literal("worlds.csv.v1"),
    }).annotate(exact),
  ]),
  operation: Schema.Literal("ImportEvidence"),
  worldRef: WorldRef,
}).annotate(exact);
export const Inspect = Schema.Struct({
  ...envelope,
  input: Schema.Struct({
    atFrame: Schema.NullOr(FrameRef),
    subjectKey: SubjectKey,
  }).annotate(exact),
  operation: Schema.Literal("Inspect"),
  worldRef: WorldRef,
}).annotate(exact);
export const OpenEvidence = Schema.Struct({
  ...envelope,
  input: Schema.Struct({ evidenceRef: EvidenceRef }).annotate(exact),
  operation: Schema.Literal("OpenEvidence"),
  worldRef: WorldRef,
}).annotate(exact);

export { CorrectionChoice, CorrectionConsequence } from "./evidence.js";
export const ProposeCorrection = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    consequence: CorrectionConsequence,
    frameRef: FrameRef,
  }).annotate(exact),
  operation: Schema.Literal("ProposeCorrection"),
  worldRef: WorldRef,
}).annotate(exact);
export const QuestionAnswer = Schema.Literals(["confirm", "unknown"]);
export const AnswerQuestion = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    answer: QuestionAnswer,
    consequenceDigest: Digest,
    questionRef: QuestionRef,
  }).annotate(exact),
  operation: Schema.Literal("AnswerQuestion"),
  worldRef: WorldRef,
}).annotate(exact);
export const UndoCorrection = Schema.Struct({
  ...mutation,
  input: Schema.Struct({
    correctionRef: CorrectionRef,
    frameRef: FrameRef,
  }).annotate(exact),
  operation: Schema.Literal("UndoCorrection"),
  worldRef: WorldRef,
}).annotate(exact);

export const D01Request = Schema.Union([
  CreatePersonalWorld,
  ImportEvidence,
  Inspect,
  OpenEvidence,
]);
export type D01Request = typeof D01Request.Type;
export const CorrectionRequest = Schema.Union([
  ProposeCorrection,
  AnswerQuestion,
  UndoCorrection,
]);
export type CorrectionRequest = typeof CorrectionRequest.Type;
export const SemanticRequest = Schema.Union([
  D01Request,
  CorrectionRequest,
  SharingRequest,
  SubjectIdentityRequest,
  WorldErasureRequest,
  EveConversationRequest,
]);
export type SemanticRequest = typeof SemanticRequest.Type;
export const decodeD01Request = Schema.decodeUnknownEffect(D01Request);
export const decodeSemanticRequest =
  Schema.decodeUnknownEffect(SemanticRequest);

export const WorldCreated = Schema.TaggedStruct("WorldCreated", {
  receiptRef: ReceiptRef,
  worldRef: WorldRef,
}).annotate(exact);
export const EvidenceImported = Schema.TaggedStruct("EvidenceImported", {
  evidenceRef: EvidenceRef,
  receiptRef: ReceiptRef,
  sourceRef: SourceRef,
}).annotate(exact);
export const FrameInspected = Schema.TaggedStruct("FrameInspected", {
  frame: VisibleFrame,
}).annotate(exact);
export const EvidenceOpened = Schema.TaggedStruct("EvidenceOpened", {
  document: DocumentText,
  evidenceRef: EvidenceRef,
  mediaType: Schema.Literals(["application/json", "text/csv"]),
}).annotate(exact);
export const CorrectionProposed = Schema.TaggedStruct("CorrectionProposed", {
  caseRef: CaseRef,
  consequence: CorrectionConsequence,
  consequenceDigest: Digest,
  questionRef: QuestionRef,
  receiptRef: ReceiptRef,
}).annotate(exact);
export const CorrectionApplied = Schema.TaggedStruct("CorrectionApplied", {
  correctionRef: CorrectionRef,
  receiptRef: ReceiptRef,
}).annotate(exact);
export const CorrectionUndone = Schema.TaggedStruct("CorrectionUndone", {
  correctionRef: CorrectionRef,
  receiptRef: ReceiptRef,
}).annotate(exact);

export const D01Success = Schema.Union([
  WorldCreated,
  EvidenceImported,
  FrameInspected,
  EvidenceOpened,
]);
export type D01Success = typeof D01Success.Type;
export const CorrectionSuccess = Schema.Union([
  CorrectionProposed,
  CorrectionApplied,
  CorrectionUndone,
]);
export type CorrectionSuccess = typeof CorrectionSuccess.Type;
export const SemanticSuccess = Schema.Union([
  D01Success,
  CorrectionSuccess,
  SharingSuccess,
  SubjectIdentitySuccess,
  WorldErasureSuccess,
  EveConversationSuccess,
]);
export type SemanticSuccess = typeof SemanticSuccess.Type;
export const SemanticResult = Schema.Union([SemanticSuccess, D01Error]);
export type SemanticResult = typeof SemanticResult.Type;
