/** Ontology evidence package entry (SPEC-004). */
export { CaptureStager, isStaged, isQuarantined } from './capture.js';
export type {
  CaptureState,
  SourceBinding,
  DeclaredCaptureMetadata,
  CaptureRef,
  QuarantinedCapture,
  StageCaptureResult,
} from './types.js';
export type { CaptureByteSource, StageCapturePort } from './ports.js';
