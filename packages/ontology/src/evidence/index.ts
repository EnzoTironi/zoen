/** Ontology evidence package entry (SPEC-004). */
export { CaptureStager, isStaged, isQuarantined } from './capture.js';
export { CaptureAdmission } from './admission.js';
export { EvidenceReader } from './evidence-read.js';
export type {
  CaptureState,
  SourceBinding,
  DeclaredCaptureMetadata,
  CaptureRef,
  QuarantinedCapture,
  StageCaptureResult,
  AdmissionReceipt,
  AdmitCaptureInput,
  EvidenceContentState,
  EvidenceRef,
  EvidenceGrant,
  EvidenceReceiptMeta,
  AuthorizedStream,
  ReadEvidenceInput,
  ReadEvidenceResult,
} from './types.js';
export type {
  CaptureByteSource,
  StageCapturePort,
  AdmitCapturePort,
  ReadEvidencePort,
} from './ports.js';
