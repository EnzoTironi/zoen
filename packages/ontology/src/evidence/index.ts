/** Ontology evidence package entry (SPEC-004). */
export { CaptureStager, isStaged, isQuarantined } from './capture.js';
export { CaptureAdmission } from './admission.js';
export { EvidenceReader } from './evidence-read.js';
export { EvidenceExtractor, EXTRACTOR_IMPL } from './extract.js';
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
  CsvExtractProfile,
  JsonExtractProfile,
  ExtractProfile,
  ExtractCandidate,
  ExtractInput,
  ExtractResult,
} from './types.js';
export type {
  CaptureByteSource,
  StageCapturePort,
  AdmitCapturePort,
  ReadEvidencePort,
  ExtractPort,
} from './ports.js';
