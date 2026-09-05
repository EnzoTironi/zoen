import { Schema } from "effect";

import {
  ClaimRef,
  CorrectionRef,
  Currency,
  D01_LIMITS,
  DateInterval,
  DecimalText,
  EvidenceRef,
  FrameRef,
  Label,
  RecordKey,
  ReceiptRef,
  SourceRef,
  SourceRevision,
  SubjectKey,
  ValidTime,
  WorldRef,
  exact,
} from "./values.js";

export const KnownAmount = Schema.TaggedStruct("Known", {
  amount: DecimalText,
  currency: Currency,
}).annotate(exact);
export const UnknownAmount = Schema.TaggedStruct("Unknown", {}).annotate(exact);
export const AmountValue = Schema.Union([KnownAmount, UnknownAmount]);
export type AmountValue = typeof AmountValue.Type;

export const SourceDescriptor = Schema.Struct({
  externalId: RecordKey,
  label: Label,
  namespace: RecordKey,
  revision: SourceRevision,
}).annotate(exact);
export const ImportRecord = Schema.Struct({
  externalId: RecordKey,
  predicate: Schema.Literal("obligation.amount"),
  subjectKey: SubjectKey,
  validTime: ValidTime,
  value: AmountValue,
}).annotate(exact);
export const ImportDocument = Schema.Struct({
  records: Schema.Array(ImportRecord).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(D01_LIMITS.records)
  ),
  schemaVersion: Schema.Literal("d01.v1"),
  source: SourceDescriptor,
}).annotate(exact);
export type ImportDocument = typeof ImportDocument.Type;
export const decodeImportDocument = Schema.decodeUnknownEffect(ImportDocument);

export const VisibleClaim = Schema.Struct({
  claimRef: ClaimRef,
  evidenceRef: EvidenceRef,
  predicate: Schema.Literal("obligation.amount"),
  recordId: RecordKey,
  recordIndex: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThan(D01_LIMITS.records)
  ),
  source: SourceDescriptor,
  sourceRef: SourceRef,
  subjectKey: SubjectKey,
  validTime: ValidTime,
  value: AmountValue,
  verification: Schema.Literal("unverified"),
}).annotate(exact);
export type VisibleClaim = typeof VisibleClaim.Type;

export const Selection = Schema.Union([
  Schema.TaggedStruct("unknown", {}).annotate(exact),
  Schema.TaggedStruct("unresolved", {}).annotate(exact),
  Schema.TaggedStruct("selected", { claimRef: ClaimRef }).annotate(exact),
  Schema.TaggedStruct("set-valued", {
    claimRefs: Schema.Array(ClaimRef).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(D01_LIMITS.frameClaims)
    ),
  }).annotate(exact),
]);
export const Coverage = Schema.Union([
  Schema.TaggedStruct("Unknown", {}).annotate(exact),
  Schema.TaggedStruct("Partial", {}).annotate(exact),
]);
export const CorrectionChoice = Schema.Union([
  Schema.TaggedStruct("selectClaim", { claimRef: ClaimRef }).annotate(exact),
  Schema.TaggedStruct("unknown", {}).annotate(exact),
]);
export const CorrectionConsequence = Schema.Struct({
  choice: CorrectionChoice,
  subjectKey: SubjectKey,
  validTime: DateInterval,
}).annotate(exact);
export const ScopedCorrection = Schema.Struct({
  ...CorrectionConsequence.fields,
  authoredBy: Schema.Literal("current-principal"),
  correctionRef: CorrectionRef,
  receiptRef: ReceiptRef,
}).annotate(exact);
export type ScopedCorrection = typeof ScopedCorrection.Type;

export const VisibleFrame = Schema.Struct({
  claims: Schema.Array(VisibleClaim).check(
    Schema.isMaxLength(D01_LIMITS.frameClaims)
  ),
  contested: Schema.Boolean,
  coverage: Coverage,
  frameRef: FrameRef,
  scopedCorrections: Schema.Array(ScopedCorrection).check(
    Schema.isMaxLength(D01_LIMITS.frameClaims)
  ),
  selection: Selection,
  subjectKey: SubjectKey,
  verification: Schema.Literal("unverified"),
  worldRef: WorldRef,
}).annotate(exact);
export type VisibleFrame = typeof VisibleFrame.Type;
