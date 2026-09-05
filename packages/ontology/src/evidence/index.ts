/** Ontology evidence package entry (SPEC-004). */
export { CaptureStager, isStaged, isQuarantined } from './capture.js';
export { CaptureAdmission } from './admission.js';
export type {
  CaptureState,
  SourceBinding,
  DeclaredCaptureMetadata,
  CaptureRef,
  QuarantinedCapture,
  StageCaptureResult,
  AdmissionReceipt,
  AdmitCaptureInput,
} from './types.js';
export type { CaptureByteSource, StageCapturePort, AdmitCapturePort } from './ports.js';
