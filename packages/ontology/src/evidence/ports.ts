import type {
  AdmissionReceipt,
  AdmitCaptureInput,
  CaptureGcInput,
  CaptureGcResult,
  CaptureRef,
  DeclaredCaptureMetadata,
  ExtractInput,
  ExtractResult,
  QuarantinedCapture,
  ReadEvidenceInput,
  ReadEvidenceResult,
  RetentionPinInput,
  SourceBinding,
  StageCaptureResult,
} from './types.js';
import type { UUID } from '../../../kernel/src/ids.js';

export type {
  AdmissionReceipt,
  AdmitCaptureInput,
  CaptureGcInput,
  CaptureGcResult,
  CaptureRef,
  DeclaredCaptureMetadata,
  ExtractInput,
  ExtractResult,
  QuarantinedCapture,
  ReadEvidenceInput,
  ReadEvidenceResult,
  RetentionPinInput,
  SourceBinding,
  StageCaptureResult,
};

export type CaptureByteSource = AsyncIterable<Uint8Array> | Uint8Array;

export interface StageCapturePort {
  stageCapture(
    binding: SourceBinding,
    bytes: CaptureByteSource,
    metadata: DeclaredCaptureMetadata,
  ): Promise<StageCaptureResult>;
}

export interface AdmitCapturePort {
  admitCapture(input: AdmitCaptureInput): Promise<AdmissionReceipt>;
}

export interface ReadEvidencePort {
  readEvidence(input: ReadEvidenceInput): Promise<ReadEvidenceResult>;
}

export interface ExtractPort {
  extract(input: ExtractInput): Promise<ExtractResult>;
}

export interface CaptureGcPort {
  pinCapture(input: RetentionPinInput): Promise<{ pinId: UUID }>;
  collectOrphan(input: CaptureGcInput): Promise<CaptureGcResult>;
}
