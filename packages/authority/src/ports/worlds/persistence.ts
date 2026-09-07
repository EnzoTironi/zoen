import { WorldErasureSuccess } from "@zoen/contracts/erasure/operations";
import { SharingMutationSuccess } from "@zoen/contracts/sharing/operations";
import { SubjectIdentitySuccess } from "@zoen/contracts/subject-identity/operations";
import {
  CorrectionConsequence,
  CorrectionSuccess,
  EvidenceImported,
  QuestionAnswer,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import {
  CorrectionRef,
  Digest,
  QuestionRef,
  exact,
} from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

export const StoredOperationResult = Schema.Union([
  WorldCreated,
  EvidenceImported,
  CorrectionSuccess,
  SharingMutationSuccess,
  SubjectIdentitySuccess,
  WorldErasureSuccess,
]);
export const StoredQuestion = Schema.Struct({
  allowedAnswers: Schema.Array(QuestionAnswer).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(2)
  ),
  consequenceDigest: Digest,
  questionRef: QuestionRef,
  version: Schema.Literal("worlds.v1"),
}).annotate(exact);
export const CorrectionAnswer = Schema.Union([
  Schema.TaggedStruct("Answer", {
    answer: QuestionAnswer,
    consequence: CorrectionConsequence,
  }).annotate(exact),
  Schema.TaggedStruct("Undo", {
    correctionRef: CorrectionRef,
  }).annotate(exact),
]);
export const CaptureState = Schema.Literals([
  "reserved",
  "uploaded",
  "admitted",
  "cleanup_pending",
  "removed",
]);
export const EvidenceState = Schema.Literals([
  "admitted",
  "unavailable",
  "erasure_pending",
]);
export const CaseState = Schema.Literals([
  "proposed",
  "applied",
  "blocked",
  "cancelled",
]);
export const OutboxState = Schema.Literals(["pending", "leased", "delivered"]);
